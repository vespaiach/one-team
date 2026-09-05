import { readFileSync } from "node:fs";
import { join } from "node:path";
import { asc } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { boardColumn, issue, project, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import type { Actor } from "@/features/auth/server/actor";
import { SEED_COLUMNS } from "../seed-columns";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const { createColumn } = await import("./create-column");
const { updateColumn } = await import("./update-column");
const { moveColumn } = await import("./move-column");
const { deleteColumn } = await import("./delete-column");

const FEATURE_DIR = join(process.cwd(), "src", "features", "projects");

const SCANNED_FILES = [
  join(FEATURE_DIR, "server", "create-column.ts"),
  join(FEATURE_DIR, "server", "update-column.ts"),
  join(FEATURE_DIR, "server", "move-column.ts"),
  join(FEATURE_DIR, "server", "delete-column.ts"),
  join(FEATURE_DIR, "column-actions.ts"),
];

beforeEach(async () => {
  await truncateTestDatabase();
});

function schemaImportNames(source: string): string[] {
  const match = source.match(/import\s*\{([^}]*)\}\s*from\s*"@\/db\/schema"/);
  return (match?.[1] ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name !== "");
}

async function insertUser(role: "admin" | "member"): Promise<Actor> {
  const now = new Date();
  const [row] = await testDb
    .insert(user)
    .values({
      firstName: "Ada",
      lastName: "Lovelace",
      email: `ada-${crypto.randomUUID()}@example.com`,
      role,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!row) {
    throw new Error("insertUser produced no row");
  }
  return {
    id: row.id,
    role: row.role,
    firstName: row.firstName,
    lastName: row.lastName,
    avatarUrl: null,
    mustChangePassword: false,
  };
}

async function insertProject() {
  const now = new Date();
  const [row] = await testDb
    .insert(project)
    .values({
      key: `P${crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      name: "Website Redesign",
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!row) {
    throw new Error("insertProject produced no row");
  }
  return row;
}

async function insertSeedColumns(projectId: string) {
  const now = new Date();
  return await testDb
    .insert(boardColumn)
    .values(SEED_COLUMNS.map((column) => ({ ...column, projectId, createdAt: now, updatedAt: now })))
    .returning();
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

async function insertIssue(projectId: string, columnId: string, createdBy: string, number: number) {
  const now = new Date();
  const [row] = await testDb
    .insert(issue)
    .values({
      projectId,
      number,
      title: `Issue ${number}`,
      columnId,
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

function columnNamed(rows: (typeof boardColumn.$inferSelect)[], name: string) {
  const row = rows.find((column) => column.name === name);
  if (!row) {
    throw new Error(`no column named ${name}`);
  }
  return row;
}

async function censusIssues() {
  return await testDb
    .select({
      id: issue.id,
      columnId: issue.columnId,
      sortOrder: issue.sortOrder,
      updatedAt: issue.updatedAt,
    })
    .from(issue)
    .orderBy(asc(issue.id));
}

describe("no column mutator writes the issue table — source scan (SC-002, FR-022, FR-028, FR-041)", () => {
  for (const path of SCANNED_FILES) {
    it(`${path.split("/").pop()} names no issue write`, () => {
      const source = readFileSync(path, "utf8");

      expect(schemaImportNames(source)).not.toContain("issue");
      expect(source).not.toMatch(/\.\s*(insert|update|delete)\s*\(\s*issue\b/);
      expect(source).not.toMatch(/(insert\s+into|update|delete\s+from)\s+"?issue"?\b/i);
    });
  }
});

describe("no column mutator writes the issue table — a census across every path (SC-002, §4)", () => {
  it("leaves every issue's column_id, sort_order and updated_at identical across all four mutators and every refusal", async () => {
    const admin = await insertUser("admin");
    const member = await insertUser("member");
    const proj = await insertProject();
    const columns = await insertSeedColumns(proj.id);
    const backlog = columnNamed(columns, "Backlog");
    const todo = columnNamed(columns, "Todo");
    const inProgress = columnNamed(columns, "In Progress");
    const done = columnNamed(columns, "Done");
    const canceled = columnNamed(columns, "Canceled");
    await insertIssue(proj.id, backlog.id, admin.id, 1);
    await insertIssue(proj.id, backlog.id, admin.id, 2);
    await insertIssue(proj.id, todo.id, admin.id, 3);
    await insertIssue(proj.id, inProgress.id, admin.id, 4);

    const soleProject = await insertProject();
    const soleColumn = await insertColumn(soleProject.id, "Only", "open", "a0");

    const before = await censusIssues();
    expect(before).toHaveLength(4);

    expect(await createColumn({ actor: member, projectKey: proj.key, name: "Review" })).toEqual({
      ok: false,
      error: "forbidden",
    });
    expect(await createColumn({ actor: admin, projectKey: proj.key, name: "   " })).toEqual({
      ok: false,
      error: "invalid_name",
      reason: "required",
    });
    expect(await createColumn({ actor: admin, projectKey: proj.key, name: "R".repeat(201) })).toEqual({
      ok: false,
      error: "invalid_name",
      reason: "too_long",
    });
    expect(await createColumn({ actor: admin, projectKey: proj.key, name: "backlog" })).toEqual({
      ok: false,
      error: "duplicate_name",
      holder: { id: backlog.id, name: backlog.name },
    });
    const created = await createColumn({ actor: admin, projectKey: proj.key, name: "Review" });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      throw new Error("unreachable");
    }

    expect(await updateColumn({ actor: member, columnId: todo.id, name: "Up next" })).toEqual({
      ok: false,
      error: "forbidden",
    });
    expect(await updateColumn({ actor: admin, columnId: todo.id, name: " " })).toEqual({
      ok: false,
      error: "invalid_name",
      reason: "required",
    });
    expect(await updateColumn({ actor: admin, columnId: todo.id, name: "U".repeat(201) })).toEqual({
      ok: false,
      error: "invalid_name",
      reason: "too_long",
    });
    expect(await updateColumn({ actor: admin, columnId: todo.id, name: "backlog" })).toEqual({
      ok: false,
      error: "duplicate_name",
      holder: { id: backlog.id, name: backlog.name },
    });
    expect(await updateColumn({ actor: admin, columnId: todo.id, name: "Up next" })).toEqual({ ok: true });

    expect(
      await moveColumn({
        actor: member,
        columnId: backlog.id,
        targetColumnId: done.id,
        placement: "after",
      }),
    ).toEqual({ ok: false, error: "forbidden" });
    expect(
      await moveColumn({
        actor: admin,
        columnId: backlog.id,
        targetColumnId: done.id,
        placement: "sideways",
      }),
    ).toEqual({ ok: false, error: "invalid_input" });
    expect(
      await moveColumn({
        actor: admin,
        columnId: backlog.id,
        targetColumnId: crypto.randomUUID(),
        placement: "after",
      }),
    ).toEqual({ ok: false, error: "not_found" });
    expect(
      await moveColumn({
        actor: admin,
        columnId: backlog.id,
        targetColumnId: soleColumn.id,
        placement: "after",
      }),
    ).toEqual({ ok: false, error: "invalid_target" });
    expect(
      await moveColumn({
        actor: admin,
        columnId: backlog.id,
        targetColumnId: done.id,
        placement: "after",
      }),
    ).toEqual({ ok: true });

    expect(await deleteColumn({ actor: member, projectId: proj.id, columnId: created.column.id })).toEqual({
      ok: false,
      error: "forbidden",
    });
    expect(await deleteColumn({ actor: admin, projectId: proj.id, columnId: crypto.randomUUID() })).toEqual({
      ok: false,
      error: "not_found",
    });
    expect(await deleteColumn({ actor: admin, projectId: proj.id, columnId: backlog.id })).toEqual({
      ok: false,
      error: "refused",
      refusal: "holds_issues",
    });
    expect(await deleteColumn({ actor: admin, projectId: proj.id, columnId: canceled.id })).toEqual({
      ok: false,
      error: "refused",
      refusal: "last_canceled_kind",
    });
    expect(await deleteColumn({ actor: admin, projectId: proj.id, columnId: done.id })).toEqual({
      ok: false,
      error: "refused",
      refusal: "last_done_kind",
    });
    expect(await deleteColumn({ actor: admin, projectId: soleProject.id, columnId: soleColumn.id })).toEqual({
      ok: false,
      error: "refused",
      refusal: "last_column",
    });
    expect(await deleteColumn({ actor: admin, projectId: proj.id, columnId: created.column.id })).toEqual({
      ok: true,
    });

    expect(await censusIssues()).toEqual(before);
  });
});