import { readFileSync } from "node:fs";
import { asc } from "drizzle-orm";
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

describe("moveIssue refuses in a fixed order (FR-033, FR-034, FR-035, FR-041)", () => {
  it("raises notFound for an unparseable issueId before anything returns", async () => {
    const { owner, columns } = await seedBoard();
    const before = await census();

    await expect(
      moveIssue({
        actor: actorFor(owner),
        issueId: "not-a-uuid",
        grouping: "column",
        laneId: columnId(columns, "In Progress"),
        targetIssueId: null,
        placement: "before",
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(notFoundMock).toHaveBeenCalled();
    expect(await census()).toEqual(before);
  });

  it("reports a missing issue as not_found even for a non-member, the row before the role", async () => {
    const { columns } = await seedBoard();
    const stranger = await insertUser();
    const before = await census();

    const result = await moveIssue({
      actor: actorFor(stranger),
      issueId: crypto.randomUUID(),
      grouping: "column",
      laneId: columnId(columns, "In Progress"),
      targetIssueId: null,
      placement: "before",
    });

    expect(result).toEqual({ ok: false, error: "not_found" });
    expect(await census()).toEqual(before);
  });

  it("refuses a non-member with forbidden and a reason naming the project", async () => {
    const { project: board, columns, issues } = await seedBoard("Apollo Rewrite");
    const stranger = await insertUser();
    const before = await census();

    const result = await moveIssue({
      actor: actorFor(stranger),
      issueId: issueId(issues, 1),
      grouping: "column",
      laneId: columnId(columns, "In Progress"),
      targetIssueId: null,
      placement: "before",
    });

    expect(result).toEqual({
      ok: false,
      error: "forbidden",
      reason: expect.stringContaining(board.name) as string,
    });
    expect(await census()).toEqual(before);
  });

  it("reports a laneId naming no board column anywhere as not_found", async () => {
    const { owner, issues } = await seedBoard();
    const before = await census();

    const result = await moveIssue({
      actor: actorFor(owner),
      issueId: issueId(issues, 1),
      grouping: "column",
      laneId: crypto.randomUUID(),
      targetIssueId: null,
      placement: "before",
    });

    expect(result).toEqual({ ok: false, error: "not_found" });
    expect(await census()).toEqual(before);
  });

  it("reports a laneId naming another project's column as invalid_target", async () => {
    const { owner, issues } = await seedBoard();
    const other = await seedBoard("Other Project");
    const before = await census();

    const result = await moveIssue({
      actor: actorFor(owner),
      issueId: issueId(issues, 1),
      grouping: "column",
      laneId: columnId(other.columns, "In Progress"),
      targetIssueId: null,
      placement: "before",
    });

    expect(result).toEqual({ ok: false, error: "invalid_target" });
    expect(await census()).toEqual(before);
  });

  it("reports a targetIssueId naming a card outside this lane as not_found", async () => {
    const { owner, columns, issues } = await seedBoard();
    const before = await census();

    const result = await moveIssue({
      actor: actorFor(owner),
      issueId: issueId(issues, 1),
      grouping: "column",
      laneId: columnId(columns, "In Progress"),
      targetIssueId: issueId(issues, 2),
      placement: "before",
    });

    expect(result).toEqual({ ok: false, error: "not_found" });
    expect(await census()).toEqual(before);
  });

  it("refuses a malformed grouping as invalid_target, never as not_found", async () => {
    const { owner, columns, issues } = await seedBoard();
    const before = await census();

    const result = await moveIssue({
      actor: actorFor(owner),
      issueId: issueId(issues, 1),
      grouping: "columns",
      laneId: columnId(columns, "In Progress"),
      targetIssueId: null,
      placement: "before",
    });

    expect(result).toEqual({ ok: false, error: "invalid_target" });
    expect(await census()).toEqual(before);
  });

  it("refuses a malformed placement as invalid_target, never defaulting it", async () => {
    const { owner, columns, issues } = await seedBoard();
    const before = await census();

    const result = await moveIssue({
      actor: actorFor(owner),
      issueId: issueId(issues, 1),
      grouping: "column",
      laneId: columnId(columns, "In Progress"),
      targetIssueId: null,
      placement: "afterwards",
    });

    expect(result).toEqual({ ok: false, error: "invalid_target" });
    expect(await census()).toEqual(before);
  });

  it("refuses a malformed laneId as invalid_target", async () => {
    const { owner, issues } = await seedBoard();
    const before = await census();

    const result = await moveIssue({
      actor: actorFor(owner),
      issueId: issueId(issues, 1),
      grouping: "column",
      laneId: 7,
      targetIssueId: null,
      placement: "before",
    });

    expect(result).toEqual({ ok: false, error: "invalid_target" });
    expect(await census()).toEqual(before);
  });

  it("declares exactly five outcomes and no invalid_input", () => {
    const source = readFileSync(MODULE_SOURCE_PATH, "utf8");
    const start = source.indexOf("export type MoveIssueState");
    const declaration = source.slice(start, source.indexOf("\n\n", start));

    expect(declaration.match(/\bok\b/g)).toHaveLength(5);
    expect(declaration).toContain('error: "not_found"');
    expect(declaration).toContain('error: "invalid_target"');
    expect(declaration).toContain('error: "forbidden"');
    expect(declaration).toContain('error: "no_index_available"');
    expect(declaration).not.toContain("invalid_input");
  });
});