import { readFileSync } from "node:fs";
import { asc, eq } from "drizzle-orm";
import { generateKeyBetween } from "fractional-indexing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { activity, boardColumn, issue, project, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import type { Actor } from "@/features/auth/server/actor";
import { moveColumn } from "./move-column";

const { notFoundMock } = vi.hoisted(() => ({
  notFoundMock: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

const MODULE_SOURCE_PATH = new URL("./move-column.ts", import.meta.url);

const SEEDED_COLUMNS = [
  { name: "Backlog", kind: "open", sortOrder: "a0" },
  { name: "Todo", kind: "open", sortOrder: "a1" },
  { name: "In Progress", kind: "open", sortOrder: "a2" },
  { name: "Done", kind: "done", sortOrder: "a3" },
  { name: "Canceled", kind: "canceled", sortOrder: "a4" },
];

beforeEach(async () => {
  await truncateTestDatabase();
  notFoundMock.mockClear();
  vi.restoreAllMocks();
});

function actor(overrides: Partial<Actor> = {}): Actor {
  return {
    id: crypto.randomUUID(),
    role: "admin",
    firstName: "Ada",
    lastName: "Lovelace",
    avatarUrl: null,
    mustChangePassword: false,
    ...overrides,
  };
}

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

async function insertProject(status = "active") {
  const now = new Date();
  const [row] = await testDb
    .insert(project)
    .values({
      key: `P${crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      name: "Website Redesign",
      status,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!row) {
    throw new Error("insertProject produced no row");
  }
  return row;
}

async function insertColumn(projectId: string, name: string, kind: string, sortOrder: string) {
  const now = new Date();
  const [row] = await testDb
    .insert(boardColumn)
    .values({ projectId, name, kind, sortOrder, createdAt: now, updatedAt: now })
    .returning();
  if (!row) {
    throw new Error("insertColumn produced no row");
  }
  return row;
}

async function seedBoard(status = "active") {
  const owner = await insertUser();
  const board = await insertProject(status);
  const columns = new Map<string, typeof boardColumn.$inferSelect>();
  for (const seed of SEEDED_COLUMNS) {
    columns.set(seed.name, await insertColumn(board.id, seed.name, seed.kind, seed.sortOrder));
  }
  return { owner, project: board, columns };
}

function columnId(columns: Map<string, typeof boardColumn.$inferSelect>, name: string): string {
  const row = columns.get(name);
  if (!row) {
    throw new Error(`no seeded column named ${name}`);
  }
  return row.id;
}

async function readBoardOrder(projectId: string) {
  return testDb
    .select()
    .from(boardColumn)
    .where(eq(boardColumn.projectId, projectId))
    .orderBy(asc(boardColumn.sortOrder), asc(boardColumn.id));
}

async function insertIssue(projectId: string, targetColumnId: string, createdBy: string, number: number) {
  const now = new Date();
  const [row] = await testDb
    .insert(issue)
    .values({
      projectId,
      number,
      title: `Issue ${number}`,
      columnId: targetColumnId,
      createdBy,
      sortOrder: `a${number}`,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!row) {
    throw new Error("insertIssue produced no row");
  }
  return row;
}

async function censusIssues(projectId: string) {
  const rows = await testDb
    .select()
    .from(issue)
    .where(eq(issue.projectId, projectId))
    .orderBy(asc(issue.number));
  return rows.map((row) => ({
    id: row.id,
    columnId: row.columnId,
    sortOrder: row.sortOrder,
    updatedAt: row.updatedAt.toISOString(),
  }));
}

describe("moveColumn (FR-010, FR-028, FR-029, FR-033, contracts/mutators.md)", () => {
  it("rewrites sort_order on the moved row only, from generateKeyBetween of its new neighbours", async () => {
    const { owner, project: board, columns } = await seedBoard();
    const before = await readBoardOrder(board.id);

    const result = await moveColumn({
      actor: actor({ id: owner.id }),
      columnId: columnId(columns, "Canceled"),
      targetColumnId: columnId(columns, "Backlog"),
      placement: "before",
    });

    expect(result).toEqual({ ok: true });
    expect(Object.keys(result)).toEqual(["ok"]);

    const after = await readBoardOrder(board.id);
    expect(after.map((row) => row.name)).toEqual(["Canceled", "Backlog", "Todo", "In Progress", "Done"]);

    const movedBefore = before.find((row) => row.name === "Canceled");
    const movedAfter = after.find((row) => row.name === "Canceled");
    expect(movedAfter?.sortOrder).toBe(generateKeyBetween(null, "a0"));
    expect(movedAfter?.name).toBe(movedBefore?.name);
    expect(movedAfter?.kind).toBe(movedBefore?.kind);

    const untouchedBefore = before
      .filter((row) => row.name !== "Canceled")
      .map((row) => ({
        id: row.id,
        name: row.name,
        kind: row.kind,
        sortOrder: row.sortOrder,
        updatedAt: row.updatedAt.toISOString(),
      }));
    const untouchedAfter = after
      .filter((row) => row.name !== "Canceled")
      .map((row) => ({
        id: row.id,
        name: row.name,
        kind: row.kind,
        sortOrder: row.sortOrder,
        updatedAt: row.updatedAt.toISOString(),
      }));
    expect(untouchedAfter).toEqual(untouchedBefore);
  });

  it("splices a column into the middle between its two new neighbours", async () => {
    const { owner, columns, project: board } = await seedBoard();

    const result = await moveColumn({
      actor: actor({ id: owner.id }),
      columnId: columnId(columns, "Backlog"),
      targetColumnId: columnId(columns, "In Progress"),
      placement: "after",
    });

    expect(result).toEqual({ ok: true });
    const after = await readBoardOrder(board.id);
    expect(after.map((row) => row.name)).toEqual(["Todo", "In Progress", "Backlog", "Done", "Canceled"]);
    expect(after[2]?.sortOrder).toBe(generateKeyBetween("a2", "a3"));
  });

  it("moves no issue out of the column it was in", async () => {
    const { owner, project: board, columns } = await seedBoard();
    await insertIssue(board.id, columnId(columns, "Backlog"), owner.id, 1);
    await insertIssue(board.id, columnId(columns, "Canceled"), owner.id, 2);
    const before = await censusIssues(board.id);

    const result = await moveColumn({
      actor: actor({ id: owner.id }),
      columnId: columnId(columns, "Canceled"),
      targetColumnId: columnId(columns, "Backlog"),
      placement: "before",
    });

    expect(result).toEqual({ ok: true });
    expect(await censusIssues(board.id)).toEqual(before);
  });

  it("locks the project's column set by id and never by the sort_order it rewrites", async () => {
    const source = readFileSync(MODULE_SOURCE_PATH, "utf8");

    expect(source).toContain(".orderBy(boardColumn.id)");
    expect(source.match(/\.for\("update"\)/g)).toHaveLength(1);
    expect(source).not.toContain(".orderBy(boardColumn.sortOrder");
    expect(source).not.toContain("asc(boardColumn.sortOrder)");
  });

  it("refuses a target belonging to another project as invalid_target", async () => {
    const { owner, columns } = await seedBoard();
    const other = await seedBoard();

    const result = await moveColumn({
      actor: actor({ id: owner.id }),
      columnId: columnId(columns, "Canceled"),
      targetColumnId: columnId(other.columns, "Backlog"),
      placement: "before",
    });

    expect(result).toEqual({ ok: false, error: "invalid_target" });
  });

  it("reports a target another admin deleted as not_found rather than invalid_target", async () => {
    const { owner, project: board, columns } = await seedBoard();
    const doomed = columnId(columns, "Todo");
    await testDb.delete(boardColumn).where(eq(boardColumn.id, doomed));

    const result = await moveColumn({
      actor: actor({ id: owner.id }),
      columnId: columnId(columns, "Canceled"),
      targetColumnId: doomed,
      placement: "before",
    });

    expect(result).toEqual({ ok: false, error: "not_found" });
    expect((await readBoardOrder(board.id)).map((row) => row.name)).toEqual([
      "Backlog",
      "In Progress",
      "Done",
      "Canceled",
    ]);
  });

  it("reports the moved column vanishing between the resolve and the lock as not_found", async () => {
    const { owner, columns } = await seedBoard();
    const doomed = columnId(columns, "Canceled");
    const transactionSpy = vi.spyOn(db, "transaction");
    transactionSpy.mockImplementationOnce(async (...args) => {
      transactionSpy.mockRestore();
      await testDb.delete(boardColumn).where(eq(boardColumn.id, doomed));
      return db.transaction(...args);
    });

    const result = await moveColumn({
      actor: actor({ id: owner.id }),
      columnId: doomed,
      targetColumnId: columnId(columns, "Backlog"),
      placement: "before",
    });

    expect(result).toEqual({ ok: false, error: "not_found" });
  });

  it("treats a columnId naming no column as the missing row", async () => {
    const { owner, columns } = await seedBoard();

    await expect(
      moveColumn({
        actor: actor({ id: owner.id }),
        columnId: crypto.randomUUID(),
        targetColumnId: columnId(columns, "Backlog"),
        placement: "before",
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
  });

  it("refuses a malformed columnId as the missing row before any query", async () => {
    const { owner, columns } = await seedBoard();

    await expect(
      moveColumn({
        actor: actor({ id: owner.id }),
        columnId: "not-a-uuid",
        targetColumnId: columnId(columns, "Backlog"),
        placement: "before",
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("refuses a malformed targetColumnId as not_found", async () => {
    const { owner, columns } = await seedBoard();

    const result = await moveColumn({
      actor: actor({ id: owner.id }),
      columnId: columnId(columns, "Canceled"),
      targetColumnId: "not-a-uuid",
      placement: "before",
    });

    expect(result).toEqual({ ok: false, error: "not_found" });
  });

  it("refuses a placement that is neither before nor after, never defaulting it", async () => {
    const { owner, project: board, columns } = await seedBoard();

    const result = await moveColumn({
      actor: actor({ id: owner.id }),
      columnId: columnId(columns, "Canceled"),
      targetColumnId: columnId(columns, "Backlog"),
      placement: "afterwards",
    });

    expect(result).toEqual({ ok: false, error: "invalid_input" });
    expect((await readBoardOrder(board.id)).map((row) => row.name)).toEqual([
      "Backlog",
      "Todo",
      "In Progress",
      "Done",
      "Canceled",
    ]);
  });

  it("refuses a non-admin with forbidden and writes nothing", async () => {
    const { owner, project: board, columns } = await seedBoard();
    const before = await readBoardOrder(board.id);

    const result = await moveColumn({
      actor: actor({ id: owner.id, role: "member" }),
      columnId: columnId(columns, "Canceled"),
      targetColumnId: columnId(columns, "Backlog"),
      placement: "before",
    });

    expect(result).toEqual({ ok: false, error: "forbidden" });
    expect(await readBoardOrder(board.id)).toEqual(before);
    expect(await testDb.select().from(activity)).toEqual([]);
  });

  it("writes nothing at all when the drop resolves to the index the column already occupies", async () => {
    const { owner, project: board, columns } = await seedBoard();
    const before = await readBoardOrder(board.id);

    const result = await moveColumn({
      actor: actor({ id: owner.id }),
      columnId: columnId(columns, "Todo"),
      targetColumnId: columnId(columns, "In Progress"),
      placement: "before",
    });

    expect(result).toEqual({ ok: true });
    expect(await readBoardOrder(board.id)).toEqual(before);
    expect(await testDb.select().from(activity)).toEqual([]);
  });

  it("writes one column_reordered row naming the column the moved column now follows", async () => {
    const { owner, project: board, columns } = await seedBoard();

    const result = await moveColumn({
      actor: actor({ id: owner.id }),
      columnId: columnId(columns, "Backlog"),
      targetColumnId: columnId(columns, "In Progress"),
      placement: "after",
    });

    expect(result).toEqual({ ok: true });
    const rows = await testDb.select().from(activity);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: "column_reordered",
      actorId: owner.id,
      projectId: board.id,
      issueId: null,
      field: "Backlog",
      fromValue: null,
      toValue: "In Progress",
    });
  });

  it("carries a null to_value when the moved column is now first", async () => {
    const { owner, columns } = await seedBoard();

    await moveColumn({
      actor: actor({ id: owner.id }),
      columnId: columnId(columns, "Canceled"),
      targetColumnId: columnId(columns, "Backlog"),
      placement: "before",
    });

    const rows = await testDb.select().from(activity);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: "column_reordered",
      field: "Canceled",
      fromValue: null,
      toValue: null,
    });
  });

  it("reorders the columns of an archived project", async () => {
    const { owner, project: board, columns } = await seedBoard("archived");

    const result = await moveColumn({
      actor: actor({ id: owner.id }),
      columnId: columnId(columns, "Canceled"),
      targetColumnId: columnId(columns, "Backlog"),
      placement: "before",
    });

    expect(result).toEqual({ ok: true });
    expect((await readBoardOrder(board.id)).map((row) => row.name)).toEqual([
      "Canceled",
      "Backlog",
      "Todo",
      "In Progress",
      "Done",
    ]);
  });
});