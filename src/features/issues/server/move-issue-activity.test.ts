import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { activity, boardColumn, issue, project, projectMember, user } from "@/db/schema";
import { testDb, testSql, truncateTestDatabase } from "@/db/test-database";
import type { Actor } from "@/features/auth/server/actor";
import { moveIssue } from "./move-issue";

const MODULE_SOURCE_PATH = new URL("./move-issue.ts", import.meta.url);

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

async function insertUser(firstName = "Ada", lastName = "Lovelace") {
  const now = new Date();
  const [row] = await testDb
    .insert(user)
    .values({
      firstName,
      lastName,
      email: `${lastName.toLowerCase()}-${crypto.randomUUID()}@example.com`,
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

describe("moveIssue writes the one activity row a cross-lane drop earns (FR-060, FR-061, FR-062)", () => {
  it("writes exactly one field_changed row on the issue's own feed, naming the columns", async () => {
    const { owner, columns, issues } = await seedBoard();

    const result = await moveIssue({
      actor: actorFor(owner),
      issueId: issueId(issues, 1),
      grouping: "column",
      laneId: columnId(columns, "In Progress"),
      targetIssueId: null,
      placement: "after",
    });

    expect(result).toEqual({ ok: true });

    const rows = await testDb.select().from(activity);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.type).toBe("field_changed");
    expect(rows[0]?.issueId).toBe(issueId(issues, 1));
    expect(rows[0]?.projectId).toBeNull();
    expect(rows[0]?.actorId).toBe(owner.id);
    expect(rows[0]?.field).toBe("column");
    expect(rows[0]?.fromValue).toBe("Todo");
    expect(rows[0]?.toValue).toBe("In Progress");
    expect(rows[0]?.commentId).toBeNull();
  });

  it("writes no activity row for a same-lane reorder", async () => {
    const { owner, columns, issues } = await seedBoard();

    const result = await moveIssue({
      actor: actorFor(owner),
      issueId: issueId(issues, 2),
      grouping: "column",
      laneId: columnId(columns, "Todo"),
      targetIssueId: null,
      placement: "before",
    });

    expect(result).toEqual({ ok: true });
    expect(await testDb.select().from(activity)).toEqual([]);
  });

  it("writes no activity row for a no-op drop", async () => {
    const { owner, columns, issues } = await seedBoard();

    const result = await moveIssue({
      actor: actorFor(owner),
      issueId: issueId(issues, 1),
      grouping: "column",
      laneId: columnId(columns, "Todo"),
      targetIssueId: null,
      placement: "before",
    });

    expect(result).toEqual({ ok: true });
    expect(await testDb.select().from(activity)).toEqual([]);
  });

  it("lands no row on the project's feed, whichever way the card is dropped", async () => {
    const { owner, project: board, columns, issues } = await seedBoard();

    for (const drop of [
      { issueId: issueId(issues, 1), laneId: columnId(columns, "In Progress") },
      { issueId: issueId(issues, 2), laneId: columnId(columns, "Todo") },
      { issueId: issueId(issues, 3), laneId: columnId(columns, "Todo") },
    ]) {
      await moveIssue({
        actor: actorFor(owner),
        issueId: drop.issueId,
        grouping: "column",
        laneId: drop.laneId,
        targetIssueId: null,
        placement: "after",
      });
    }

    const projectFeed = await testDb.select().from(activity).where(eq(activity.projectId, board.id));
    expect(projectFeed).toEqual([]);
  });

  it("carries a column name of the full permitted length through truncateActivityValue", async () => {
    const { owner, columns, issues } = await seedBoard();
    const longName = "N".repeat(200);
    await testDb
      .update(boardColumn)
      .set({ name: longName })
      .where(eq(boardColumn.id, columnId(columns, "In Progress")));

    await moveIssue({
      actor: actorFor(owner),
      issueId: issueId(issues, 1),
      grouping: "column",
      laneId: columnId(columns, "In Progress"),
      targetIssueId: null,
      placement: "after",
    });

    const rows = await testDb.select().from(activity);
    expect(rows[0]?.toValue).toBe(longName);
    expect(readFileSync(MODULE_SOURCE_PATH, "utf8")).toContain("truncateActivityValue");
  });

  it("adds no activity type and widens activity_type_valid by nothing", async () => {
    const rows = await testSql`
      SELECT pg_get_constraintdef(oid) AS definition
        FROM pg_constraint
       WHERE conname = 'activity_type_valid'
    `;

    expect(rows[0]?.definition).toContain("'field_changed'");
    expect(String(rows[0]?.definition).match(/'[a-z_]+'::text/g)).toHaveLength(11);
  });
});
const ACTIVITY_ROW_SOURCE_PATH = new URL("../../activity/components/activity-row.tsx", import.meta.url);

async function addMember(projectId: string, firstName: string, lastName: string) {
  const now = new Date();
  const person = await insertUser(firstName, lastName);
  await testDb.insert(projectMember).values({ projectId, userId: person.id, createdAt: now, updatedAt: now });
  return person;
}

describe("moveIssue names the field the grouping changes (FR-060, third Clarification)", () => {
  it("writes the two people's display names, never their ids, for an Assignee drop", async () => {
    const { owner, project: board, issues } = await seedBoard();
    const grace = await addMember(board.id, "Grace", "Hopper");
    await testDb
      .update(issue)
      .set({ assigneeId: owner.id })
      .where(eq(issue.id, issueId(issues, 1)));

    const result = await moveIssue({
      actor: actorFor(owner),
      issueId: issueId(issues, 1),
      grouping: "assignee",
      laneId: grace.id,
      targetIssueId: null,
      placement: "after",
    });

    expect(result).toEqual({ ok: true });

    const rows = await testDb.select().from(activity);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.type).toBe("field_changed");
    expect(rows[0]?.issueId).toBe(issueId(issues, 1));
    expect(rows[0]?.projectId).toBeNull();
    expect(rows[0]?.field).toBe("assignee");
    expect(rows[0]?.fromValue).toBe("Ada Lovelace");
    expect(rows[0]?.toValue).toBe("Grace Hopper");
    expect(rows[0]?.toValue).not.toBe(grace.id);
  });

  it("writes a null to_value for a drop into Unassigned, which the feed renders as None", async () => {
    const { owner, issues } = await seedBoard();
    await testDb
      .update(issue)
      .set({ assigneeId: owner.id })
      .where(eq(issue.id, issueId(issues, 1)));

    const result = await moveIssue({
      actor: actorFor(owner),
      issueId: issueId(issues, 1),
      grouping: "assignee",
      laneId: null,
      targetIssueId: null,
      placement: "after",
    });

    expect(result).toEqual({ ok: true });

    const rows = await testDb.select().from(activity);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.field).toBe("assignee");
    expect(rows[0]?.fromValue).toBe("Ada Lovelace");
    expect(rows[0]?.toValue).toBeNull();
    expect(readFileSync(ACTIVITY_ROW_SOURCE_PATH, "utf8")).toContain('NONE_LABEL = "None"');
  });

  it("writes the raw priority literals for a Priority drop", async () => {
    const { owner, issues } = await seedBoard();

    const result = await moveIssue({
      actor: actorFor(owner),
      issueId: issueId(issues, 1),
      grouping: "priority",
      laneId: "urgent",
      targetIssueId: null,
      placement: "after",
    });

    expect(result).toEqual({ ok: true });

    const rows = await testDb.select().from(activity);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.field).toBe("priority");
    expect(rows[0]?.fromValue).toBe("none");
    expect(rows[0]?.toValue).toBe("urgent");
  });

  it("writes no activity row for a reorder inside an Assignee or a Priority lane", async () => {
    const { owner, issues } = await seedBoard();

    for (const drop of [
      { grouping: "assignee", laneId: null, issueId: issueId(issues, 2) },
      { grouping: "priority", laneId: "none", issueId: issueId(issues, 3) },
    ]) {
      expect(
        await moveIssue({
          actor: actorFor(owner),
          issueId: drop.issueId,
          grouping: drop.grouping,
          laneId: drop.laneId,
          targetIssueId: issueId(issues, 1),
          placement: "before",
        }),
      ).toEqual({ ok: true });
    }

    expect(await testDb.select().from(activity)).toEqual([]);
  });
});