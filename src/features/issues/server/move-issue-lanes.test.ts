import { asc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { boardColumn, issue, project, projectMember, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import type { Actor } from "@/features/auth/server/actor";
import { moveIssue } from "./move-issue";

const { notFoundMock } = vi.hoisted(() => ({
  notFoundMock: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({ notFound: notFoundMock }));

const ABSENT_USER_ID = "0198d2b1-0000-7000-8000-00000000ff01";

beforeEach(async () => {
  await truncateTestDatabase();
  notFoundMock.mockClear();
});

type Person = typeof user.$inferSelect;

async function insertUser(
  firstName: string,
  lastName: string,
  overrides: Partial<typeof user.$inferInsert> = {},
): Promise<Person> {
  const now = new Date();
  const [row] = await testDb
    .insert(user)
    .values({
      firstName,
      lastName,
      email: `${lastName.toLowerCase()}-${crypto.randomUUID()}@example.com`,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    })
    .returning();
  if (!row) {
    throw new Error("insertUser produced no row");
  }
  return row;
}

const SEEDED_ISSUES = [
  { number: 1, column: "Todo", sortOrder: "a0", priority: "none", assignee: "member" },
  { number: 2, column: "Todo", sortOrder: "a1", priority: "none", assignee: null },
  { number: 3, column: "Todo", sortOrder: "a2", priority: "high", assignee: null },
  { number: 4, column: "In Progress", sortOrder: "a3", priority: "high", assignee: "leaver" },
  { number: 5, column: "In Progress", sortOrder: "a4", priority: "urgent", assignee: null },
] as const;

async function seedBoard() {
  const now = new Date(Date.now() - 60_000);
  const owner = await insertUser("Ada", "Lovelace");
  const member = await insertUser("Grace", "Hopper");
  const leaver = await insertUser("Alan", "Turing");
  const stranger = await insertUser("Edsger", "Dijkstra");
  const dormant = await insertUser("Barbara", "Liskov", { deactivatedAt: now });

  const [board] = await testDb
    .insert(project)
    .values({
      key: `P${crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      name: "Website Redesign",
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!board) {
    throw new Error("insertProject produced no row");
  }
  for (const person of [owner, member]) {
    await testDb
      .insert(projectMember)
      .values({ projectId: board.id, userId: person.id, createdAt: now, updatedAt: now });
  }

  const columns = new Map<string, typeof boardColumn.$inferSelect>();
  for (const seed of [
    { name: "Todo", kind: "open", sortOrder: "a0" },
    { name: "In Progress", kind: "open", sortOrder: "a1" },
  ]) {
    const [row] = await testDb
      .insert(boardColumn)
      .values({ ...seed, projectId: board.id, createdAt: now, updatedAt: now })
      .returning();
    if (!row) {
      throw new Error("insertColumn produced no row");
    }
    columns.set(seed.name, row);
  }

  const assigneeIds: Record<string, string> = { member: member.id, leaver: leaver.id };
  const issues = new Map<number, typeof issue.$inferSelect>();
  for (const seed of SEEDED_ISSUES) {
    const [row] = await testDb
      .insert(issue)
      .values({
        projectId: board.id,
        number: seed.number,
        title: `Issue ${seed.number}`,
        columnId: columnId(columns, seed.column),
        priority: seed.priority,
        assigneeId: seed.assignee === null ? null : (assigneeIds[seed.assignee] ?? null),
        createdBy: owner.id,
        sortOrder: seed.sortOrder,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    if (!row) {
      throw new Error("insertIssue produced no row");
    }
    issues.set(seed.number, row);
  }

  return { owner, member, leaver, stranger, dormant, project: board, columns, issues };
}

function columnId(columns: Map<string, typeof boardColumn.$inferSelect>, name: string): string {
  const row = columns.get(name);
  if (!row) {
    throw new Error(`no seeded column named ${name}`);
  }
  return row.id;
}

function issueId(issues: Map<number, typeof issue.$inferSelect>, number: number): string {
  const row = issues.get(number);
  if (!row) {
    throw new Error(`no seeded issue numbered ${number}`);
  }
  return row.id;
}

function actorFor(userRow: Person): Actor {
  return {
    id: userRow.id,
    role: userRow.role,
    firstName: userRow.firstName,
    lastName: userRow.lastName,
    avatarUrl: null,
    mustChangePassword: false,
  };
}

type Census = {
  id: string;
  columnId: string;
  assigneeId: string | null;
  priority: string;
  sortOrder: string;
  updatedAt: string;
};

async function census(projectId: string): Promise<Census[]> {
  const rows = await testDb
    .select()
    .from(issue)
    .where(eq(issue.projectId, projectId))
    .orderBy(asc(issue.number));
  return rows.map((row) => ({
    id: row.id,
    columnId: row.columnId,
    assigneeId: row.assigneeId,
    priority: row.priority,
    sortOrder: row.sortOrder,
    updatedAt: row.updatedAt.toISOString(),
  }));
}

function changedRows(before: Census[], after: Census[]): { before: Census; after: Census }[] {
  return after
    .map((row, index) => ({ before: before[index] as Census, after: row }))
    .filter((pair) => JSON.stringify(pair.before) !== JSON.stringify(pair.after));
}

describe("moveIssue resolves an Assignee lane against the pool (FR-034, FR-035, FR-037)", () => {
  it("writes assignee_id alone for a member of the pool, leaving the column and the priority", async () => {
    const { owner, member, project: board, issues } = await seedBoard();
    const before = await census(board.id);

    const result = await moveIssue({
      actor: actorFor(owner),
      issueId: issueId(issues, 2),
      grouping: "assignee",
      laneId: member.id,
      targetIssueId: issueId(issues, 1),
      placement: "before",
    });

    expect(result).toEqual({ ok: true });

    const changed = changedRows(before, await census(board.id));
    expect(changed).toHaveLength(1);
    expect(changed[0]?.after.id).toBe(issueId(issues, 2));
    expect(changed[0]?.after.assigneeId).toBe(member.id);
    expect(changed[0]?.after.columnId).toBe(changed[0]?.before.columnId);
    expect(changed[0]?.after.priority).toBe(changed[0]?.before.priority);
    expect(changed[0]?.after.sortOrder).not.toBe(changed[0]?.before.sortOrder);
  });

  it("clears assignee_id for the Unassigned lane, which is a legal target and not a missing one", async () => {
    const { owner, project: board, issues } = await seedBoard();
    const before = await census(board.id);

    const result = await moveIssue({
      actor: actorFor(owner),
      issueId: issueId(issues, 1),
      grouping: "assignee",
      laneId: null,
      targetIssueId: null,
      placement: "after",
    });

    expect(result).toEqual({ ok: true });

    const changed = changedRows(before, await census(board.id));
    expect(changed).toHaveLength(1);
    expect(changed[0]?.after.assigneeId).toBeNull();
    expect(changed[0]?.after.columnId).toBe(changed[0]?.before.columnId);
    expect(changed[0]?.after.priority).toBe(changed[0]?.before.priority);
  });

  it("refuses a deactivated user who still holds an issue here as an illegal target", async () => {
    const { owner, member, project: board, issues } = await seedBoard();
    await testDb.update(user).set({ deactivatedAt: new Date() }).where(eq(user.id, member.id));
    const before = await census(board.id);

    const result = await moveIssue({
      actor: actorFor(owner),
      issueId: issueId(issues, 2),
      grouping: "assignee",
      laneId: member.id,
      targetIssueId: null,
      placement: "after",
    });

    expect(result).toEqual({ ok: false, error: "invalid_target" });
    expect(changedRows(before, await census(board.id))).toEqual([]);
  });

  it("refuses a non-member who still holds an issue here as an illegal target", async () => {
    const { owner, leaver, project: board, issues } = await seedBoard();
    const before = await census(board.id);

    const result = await moveIssue({
      actor: actorFor(owner),
      issueId: issueId(issues, 2),
      grouping: "assignee",
      laneId: leaver.id,
      targetIssueId: null,
      placement: "after",
    });

    expect(result).toEqual({ ok: false, error: "invalid_target" });
    expect(changedRows(before, await census(board.id))).toEqual([]);
  });

  it("answers not_found for a user who is neither in the pool nor assigned here", async () => {
    const { owner, stranger, dormant, issues } = await seedBoard();

    for (const laneId of [stranger.id, dormant.id, ABSENT_USER_ID]) {
      expect(
        await moveIssue({
          actor: actorFor(owner),
          issueId: issueId(issues, 2),
          grouping: "assignee",
          laneId,
          targetIssueId: null,
          placement: "after",
        }),
      ).toEqual({ ok: false, error: "not_found" });
    }
  });

  it("writes sort_order alone for a reorder inside the Unassigned lane", async () => {
    const { owner, project: board, issues } = await seedBoard();
    const before = await census(board.id);

    const result = await moveIssue({
      actor: actorFor(owner),
      issueId: issueId(issues, 5),
      grouping: "assignee",
      laneId: null,
      targetIssueId: issueId(issues, 2),
      placement: "before",
    });

    expect(result).toEqual({ ok: true });

    const changed = changedRows(before, await census(board.id));
    expect(changed).toHaveLength(1);
    expect(changed[0]?.after.id).toBe(issueId(issues, 5));
    expect(changed[0]?.after.assigneeId).toBe(changed[0]?.before.assigneeId);
    expect(changed[0]?.after.columnId).toBe(changed[0]?.before.columnId);
    expect(changed[0]?.after.priority).toBe(changed[0]?.before.priority);
    expect(changed[0]?.after.sortOrder).not.toBe(changed[0]?.before.sortOrder);
  });
});

describe("moveIssue resolves a Priority lane against parsePriority (FR-029, FR-030, SC-004)", () => {
  it("writes priority alone, leaving the column and the assignee", async () => {
    const { owner, project: board, issues } = await seedBoard();
    const before = await census(board.id);

    const result = await moveIssue({
      actor: actorFor(owner),
      issueId: issueId(issues, 1),
      grouping: "priority",
      laneId: "urgent",
      targetIssueId: issueId(issues, 5),
      placement: "before",
    });

    expect(result).toEqual({ ok: true });

    const changed = changedRows(before, await census(board.id));
    expect(changed).toHaveLength(1);
    expect(changed[0]?.after.id).toBe(issueId(issues, 1));
    expect(changed[0]?.after.priority).toBe("urgent");
    expect(changed[0]?.after.columnId).toBe(changed[0]?.before.columnId);
    expect(changed[0]?.after.assigneeId).toBe(changed[0]?.before.assigneeId);
    expect(changed[0]?.after.sortOrder < "a4").toBe(true);
  });

  it("refuses anything parsePriority does not admit", async () => {
    const { owner, project: board, issues } = await seedBoard();
    const before = await census(board.id);

    for (const laneId of ["critical", "URGENT", "", null, 3]) {
      expect(
        await moveIssue({
          actor: actorFor(owner),
          issueId: issueId(issues, 1),
          grouping: "priority",
          laneId,
          targetIssueId: null,
          placement: "after",
        }),
      ).toEqual({ ok: false, error: "invalid_target" });
    }

    expect(changedRows(before, await census(board.id))).toEqual([]);
  });

  it("writes sort_order alone for a reorder inside one priority lane", async () => {
    const { owner, project: board, issues } = await seedBoard();
    const before = await census(board.id);

    const result = await moveIssue({
      actor: actorFor(owner),
      issueId: issueId(issues, 4),
      grouping: "priority",
      laneId: "high",
      targetIssueId: issueId(issues, 3),
      placement: "before",
    });

    expect(result).toEqual({ ok: true });

    const changed = changedRows(before, await census(board.id));
    expect(changed).toHaveLength(1);
    expect(changed[0]?.after.id).toBe(issueId(issues, 4));
    expect(changed[0]?.after.priority).toBe(changed[0]?.before.priority);
    expect(changed[0]?.after.columnId).toBe(changed[0]?.before.columnId);
    expect(changed[0]?.after.assigneeId).toBe(changed[0]?.before.assigneeId);
    expect(changed[0]?.after.sortOrder < "a2").toBe(true);
  });
});