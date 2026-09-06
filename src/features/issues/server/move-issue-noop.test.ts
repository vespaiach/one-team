import { asc } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { activity, boardColumn, issue, project, projectMember, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import type { Actor } from "@/features/auth/server/actor";
import { moveIssue } from "./move-issue";

const { notFoundMock } = vi.hoisted(() => ({
  notFoundMock: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({ notFound: notFoundMock }));

beforeEach(async () => {
  await truncateTestDatabase();
  notFoundMock.mockClear();
});

async function insertUser() {
  const now = new Date();
  const [row] = await testDb
    .insert(user)
    .values({
      firstName: "Ada",
      lastName: "Lovelace",
      email: `ada-${crypto.randomUUID()}@example.com`,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!row) {
    throw new Error("insertUser produced no row");
  }
  return row;
}

async function seedBoard(name = "Website Redesign") {
  const now = new Date(Date.now() - 60_000);
  const owner = await insertUser();
  const [board] = await testDb
    .insert(project)
    .values({
      key: `P${crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      name,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!board) {
    throw new Error("insertProject produced no row");
  }
  await testDb
    .insert(projectMember)
    .values({ projectId: board.id, userId: owner.id, createdAt: now, updatedAt: now });

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

  const issues = new Map<number, typeof issue.$inferSelect>();
  for (const seed of [
    { number: 1, column: "Todo", sortOrder: "a0" },
    { number: 2, column: "Todo", sortOrder: "a1" },
    { number: 3, column: "In Progress", sortOrder: "a2" },
  ]) {
    const [row] = await testDb
      .insert(issue)
      .values({
        projectId: board.id,
        number: seed.number,
        title: `Issue ${seed.number}`,
        columnId: columnId(columns, seed.column),
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

  return { owner, project: board, columns, issues };
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

function actorFor(userRow: { id: string; role: string }): Actor {
  return {
    id: userRow.id,
    role: userRow.role,
    firstName: "Ada",
    lastName: "Lovelace",
    avatarUrl: null,
    mustChangePassword: false,
  };
}

async function census() {
  const rows = await testDb.select().from(issue).orderBy(asc(issue.projectId), asc(issue.number));
  return rows.map((row) => ({
    id: row.id,
    columnId: row.columnId,
    assigneeId: row.assigneeId,
    priority: row.priority,
    sortOrder: row.sortOrder,
    updatedAt: row.updatedAt.toISOString(),
  }));
}

describe("moveIssue writes nothing when the drop resolves to the position already held (FR-032)", () => {
  it("returns ok having written nothing for a drop before the card that already follows it", async () => {
    const { owner, columns, issues } = await seedBoard();
    const before = await census();

    const result = await moveIssue({
      actor: actorFor(owner),
      issueId: issueId(issues, 1),
      grouping: "column",
      laneId: columnId(columns, "Todo"),
      targetIssueId: issueId(issues, 2),
      placement: "before",
    });

    expect(result).toEqual({ ok: true });
    expect(await census()).toEqual(before);
    expect(await testDb.select().from(activity)).toEqual([]);
  });

  it("returns ok having written nothing for a drop after the card that already precedes it", async () => {
    const { owner, columns, issues } = await seedBoard();
    const before = await census();

    const result = await moveIssue({
      actor: actorFor(owner),
      issueId: issueId(issues, 2),
      grouping: "column",
      laneId: columnId(columns, "Todo"),
      targetIssueId: issueId(issues, 1),
      placement: "after",
    });

    expect(result).toEqual({ ok: true });
    expect(await census()).toEqual(before);
    expect(await testDb.select().from(activity)).toEqual([]);
  });

  it("returns ok having written nothing for a drop onto the head the card already holds", async () => {
    const { owner, columns, issues } = await seedBoard();
    const before = await census();

    const result = await moveIssue({
      actor: actorFor(owner),
      issueId: issueId(issues, 1),
      grouping: "column",
      laneId: columnId(columns, "Todo"),
      targetIssueId: null,
      placement: "before",
    });

    expect(result).toEqual({ ok: true });
    expect(await census()).toEqual(before);
    expect(await testDb.select().from(activity)).toEqual([]);
  });

  it("leaves updated_at untouched on the card the no-op names", async () => {
    const { owner, columns, issues } = await seedBoard();
    const before = await census();

    await moveIssue({
      actor: actorFor(owner),
      issueId: issueId(issues, 3),
      grouping: "column",
      laneId: columnId(columns, "In Progress"),
      targetIssueId: null,
      placement: "after",
    });

    const after = await census();
    expect(after.find((row) => row.id === issueId(issues, 3))?.updatedAt).toBe(
      before.find((row) => row.id === issueId(issues, 3))?.updatedAt,
    );
  });
});