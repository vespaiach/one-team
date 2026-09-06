import { readFileSync } from "node:fs";
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

const MODULE_SOURCE_PATH = new URL("./move-issue.ts", import.meta.url);

const SEEDED_COLUMNS = [
  { name: "Todo", kind: "open", sortOrder: "a0" },
  { name: "In Progress", kind: "open", sortOrder: "a1" },
  { name: "Done", kind: "done", sortOrder: "a2" },
];

const SEEDED_ISSUES = [
  { number: 1, column: "Todo", sortOrder: "a0" },
  { number: 2, column: "Todo", sortOrder: "a1" },
  { number: 3, column: "Todo", sortOrder: "a2" },
  { number: 4, column: "In Progress", sortOrder: "a3" },
  { number: 5, column: "In Progress", sortOrder: "a4" },
];

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

async function seedBoard() {
  const now = new Date(Date.now() - 60_000);
  const owner = await insertUser();
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
  await testDb.insert(projectMember).values({
    projectId: board.id,
    userId: owner.id,
    createdAt: now,
    updatedAt: now,
  });

  const columns = new Map<string, typeof boardColumn.$inferSelect>();
  for (const seed of SEEDED_COLUMNS) {
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
  for (const seed of SEEDED_ISSUES) {
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

async function laneOrder(projectId: string, lane: string): Promise<string[]> {
  const rows = await testDb
    .select()
    .from(issue)
    .where(eq(issue.projectId, projectId))
    .orderBy(asc(issue.sortOrder), asc(issue.id));
  return rows.filter((row) => row.columnId === lane).map((row) => row.id);
}

describe("moveIssue under Column grouping (FR-028, FR-029, FR-030, FR-031, SC-002)", () => {
  it("writes sort_order and column_id on the moved row and on no other row", async () => {
    const { owner, project: board, columns, issues } = await seedBoard();
    const before = await census(board.id);

    const result = await moveIssue({
      actor: actorFor(owner),
      issueId: issueId(issues, 1),
      grouping: "column",
      laneId: columnId(columns, "In Progress"),
      targetIssueId: issueId(issues, 5),
      placement: "before",
    });

    expect(result).toEqual({ ok: true });

    const after = await census(board.id);
    const changed = changedRows(before, after);
    expect(changed).toHaveLength(1);
    expect(changed[0]?.after.id).toBe(issueId(issues, 1));
    expect(changed[0]?.after.columnId).toBe(columnId(columns, "In Progress"));
    expect(changed[0]?.after.assigneeId).toBe(changed[0]?.before.assigneeId);
    expect(changed[0]?.after.priority).toBe(changed[0]?.before.priority);
    expect(changed[0]?.after.sortOrder > "a3").toBe(true);
    expect(changed[0]?.after.sortOrder < "a4").toBe(true);
    expect(await laneOrder(board.id, columnId(columns, "In Progress"))).toEqual([
      issueId(issues, 4),
      issueId(issues, 1),
      issueId(issues, 5),
    ]);
  });

  it("writes sort_order alone on a same-lane reorder, leaving column_id exactly as it was", async () => {
    const { owner, project: board, columns, issues } = await seedBoard();
    const before = await census(board.id);

    const result = await moveIssue({
      actor: actorFor(owner),
      issueId: issueId(issues, 3),
      grouping: "column",
      laneId: columnId(columns, "Todo"),
      targetIssueId: issueId(issues, 1),
      placement: "before",
    });

    expect(result).toEqual({ ok: true });

    const after = await census(board.id);
    const changed = changedRows(before, after);
    expect(changed).toHaveLength(1);
    expect(changed[0]?.after.id).toBe(issueId(issues, 3));
    expect(changed[0]?.after.columnId).toBe(changed[0]?.before.columnId);
    expect(changed[0]?.after.sortOrder).not.toBe(changed[0]?.before.sortOrder);
    expect(await laneOrder(board.id, columnId(columns, "Todo"))).toEqual([
      issueId(issues, 3),
      issueId(issues, 1),
      issueId(issues, 2),
    ]);
  });

  it("sorts before every card in the lane for a null target placed before", async () => {
    const { owner, project: board, columns, issues } = await seedBoard();

    const result = await moveIssue({
      actor: actorFor(owner),
      issueId: issueId(issues, 1),
      grouping: "column",
      laneId: columnId(columns, "In Progress"),
      targetIssueId: null,
      placement: "before",
    });

    expect(result).toEqual({ ok: true });
    expect(await laneOrder(board.id, columnId(columns, "In Progress"))).toEqual([
      issueId(issues, 1),
      issueId(issues, 4),
      issueId(issues, 5),
    ]);
  });

  it("sorts after every card in the lane for a null target placed after", async () => {
    const { owner, project: board, columns, issues } = await seedBoard();

    const result = await moveIssue({
      actor: actorFor(owner),
      issueId: issueId(issues, 1),
      grouping: "column",
      laneId: columnId(columns, "In Progress"),
      targetIssueId: null,
      placement: "after",
    });

    expect(result).toEqual({ ok: true });
    expect(await laneOrder(board.id, columnId(columns, "In Progress"))).toEqual([
      issueId(issues, 4),
      issueId(issues, 5),
      issueId(issues, 1),
    ]);
  });

  it("writes an index sorting strictly between the two new neighbours", async () => {
    const { owner, project: board, columns, issues } = await seedBoard();

    const result = await moveIssue({
      actor: actorFor(owner),
      issueId: issueId(issues, 5),
      grouping: "column",
      laneId: columnId(columns, "Todo"),
      targetIssueId: issueId(issues, 2),
      placement: "after",
    });

    expect(result).toEqual({ ok: true });

    const [moved] = await testDb
      .select()
      .from(issue)
      .where(eq(issue.id, issueId(issues, 5)));
    expect(moved?.sortOrder > "a1").toBe(true);
    expect((moved?.sortOrder ?? "") < "a2").toBe(true);
    expect(await laneOrder(board.id, columnId(columns, "Todo"))).toEqual([
      issueId(issues, 1),
      issueId(issues, 2),
      issueId(issues, 5),
      issueId(issues, 3),
    ]);
  });

  it("writes updated_at explicitly on the moved row and on no other", async () => {
    const { owner, project: board, columns, issues } = await seedBoard();
    const before = await census(board.id);

    await moveIssue({
      actor: actorFor(owner),
      issueId: issueId(issues, 2),
      grouping: "column",
      laneId: columnId(columns, "Done"),
      targetIssueId: null,
      placement: "after",
    });

    const after = await census(board.id);
    const movedBefore = before.find((row) => row.id === issueId(issues, 2));
    const movedAfter = after.find((row) => row.id === issueId(issues, 2));
    expect(Date.parse(movedAfter?.updatedAt ?? "")).toBeGreaterThan(Date.parse(movedBefore?.updatedAt ?? ""));
    expect(after.filter((row) => row.id !== issueId(issues, 2)).map((row) => row.updatedAt)).toEqual(
      before.filter((row) => row.id !== issueId(issues, 2)).map((row) => row.updatedAt),
    );
  });

  it("accepts no sortOrder, no projectId and no rank, deriving the project from the stored row", async () => {
    const source = readFileSync(MODULE_SOURCE_PATH, "utf8");
    const declaration = source.slice(
      source.indexOf("export type MoveIssueInput"),
      source.indexOf("export type MoveIssueState"),
    );

    expect(declaration).toContain("issueId: unknown");
    expect(declaration).toContain("grouping: unknown");
    expect(declaration).toContain("laneId: unknown");
    expect(declaration).toContain("targetIssueId: unknown");
    expect(declaration).toContain("placement: unknown");
    expect(declaration).not.toContain("sortOrder");
    expect(declaration).not.toContain("projectId");
    expect(declaration).not.toContain("rank");
    expect(source.match(/\.for\("update"\)/g)).toHaveLength(1);
  });
});