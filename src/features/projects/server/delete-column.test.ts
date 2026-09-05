import { readFileSync } from "node:fs";
import { join } from "node:path";
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { activity, boardColumn, issue, project, projectMember, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import type { Actor } from "@/features/auth/server/actor";
import { SEED_COLUMNS } from "../seed-columns";
import { deleteColumn } from "./delete-column";

beforeEach(async () => {
  await truncateTestDatabase();
});

async function insertUser(overrides: Partial<typeof user.$inferInsert> = {}) {
  const now = new Date();
  const [row] = await testDb
    .insert(user)
    .values({
      firstName: "Ada",
      lastName: "Lovelace",
      email: `ada-${crypto.randomUUID()}@example.com`,
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

function actorFor(row: { id: string; role: string; firstName: string; lastName: string }): Actor {
  return {
    id: row.id,
    role: row.role,
    firstName: row.firstName,
    lastName: row.lastName,
    avatarUrl: null,
    mustChangePassword: false,
  };
}

async function insertProject(overrides: Partial<typeof project.$inferInsert> = {}) {
  const now = new Date();
  const [row] = await testDb
    .insert(project)
    .values({
      key: `P${crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      name: "Website Redesign",
      createdAt: now,
      updatedAt: now,
      ...overrides,
    })
    .returning();
  if (!row) {
    throw new Error("insertProject produced no row");
  }
  return row;
}

async function insertColumn(projectId: string, values: { name: string; kind: string; sortOrder: string }) {
  const now = new Date();
  const [row] = await testDb
    .insert(boardColumn)
    .values({ projectId, ...values, createdAt: now, updatedAt: now })
    .returning();
  if (!row) {
    throw new Error("insertColumn produced no row");
  }
  return row;
}

async function insertSeedColumns(projectId: string) {
  const now = new Date();
  return await testDb
    .insert(boardColumn)
    .values(
      SEED_COLUMNS.map((column) => ({
        projectId,
        name: column.name,
        kind: column.kind,
        sortOrder: column.sortOrder,
        createdAt: now,
        updatedAt: now,
      })),
    )
    .returning();
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

async function seededProject() {
  const admin = await insertUser({ role: "admin" });
  const proj = await insertProject();
  const columns = await insertSeedColumns(proj.id);
  return { admin, proj, columns };
}

describe("deleteColumn (FR-034…FR-041, FR-049)", () => {
  it("removes exactly the one row, leaving every other column's name, kind and order untouched", async () => {
    const { admin, proj, columns } = await seededProject();
    const todo = columnNamed(columns, "Todo");
    const before = columns.filter((column) => column.id !== todo.id);

    const result = await deleteColumn({ actor: actorFor(admin), projectId: proj.id, columnId: todo.id });

    expect(result).toEqual({ ok: true });
    const after = await testDb.select().from(boardColumn).where(eq(boardColumn.projectId, proj.id));
    expect(after).toHaveLength(4);
    expect(after.map((column) => column.id).sort()).toEqual(before.map((column) => column.id).sort());
    for (const original of before) {
      const survivor = after.find((column) => column.id === original.id);
      expect(survivor?.name).toBe(original.name);
      expect(survivor?.kind).toBe(original.kind);
      expect(survivor?.sortOrder).toBe(original.sortOrder);
      expect(survivor?.updatedAt).toEqual(original.updatedAt);
    }
  });

  it("moves, changes and destroys no issue, cascading to nothing", async () => {
    const { admin, proj, columns } = await seededProject();
    const backlog = columnNamed(columns, "Backlog");
    const todo = columnNamed(columns, "Todo");
    await insertIssue(proj.id, backlog.id, admin.id, 1);
    const census = await testDb.select().from(issue).where(eq(issue.projectId, proj.id));

    await deleteColumn({ actor: actorFor(admin), projectId: proj.id, columnId: todo.id });

    const after = await testDb.select().from(issue).where(eq(issue.projectId, proj.id));
    expect(after).toEqual(census);
  });

  it("refuses a column that holds issues, and writes nothing", async () => {
    const { admin, proj, columns } = await seededProject();
    const todo = columnNamed(columns, "Todo");
    await insertIssue(proj.id, todo.id, admin.id, 1);

    const result = await deleteColumn({ actor: actorFor(admin), projectId: proj.id, columnId: todo.id });

    expect(result).toEqual({ ok: false, error: "refused", refusal: "holds_issues" });
    const after = await testDb.select().from(boardColumn).where(eq(boardColumn.projectId, proj.id));
    expect(after).toHaveLength(5);
  });

  it("refuses the project's last column, and writes nothing", async () => {
    const admin = await insertUser({ role: "admin" });
    const proj = await insertProject();
    const only = await insertColumn(proj.id, { name: "Backlog", kind: "open", sortOrder: "a0" });

    const result = await deleteColumn({ actor: actorFor(admin), projectId: proj.id, columnId: only.id });

    expect(result).toEqual({ ok: false, error: "refused", refusal: "last_column" });
    const after = await testDb.select().from(boardColumn).where(eq(boardColumn.projectId, proj.id));
    expect(after).toHaveLength(1);
  });

  it("refuses the last canceled-kind column, and writes nothing", async () => {
    const { admin, proj, columns } = await seededProject();
    const canceled = columnNamed(columns, "Canceled");

    const result = await deleteColumn({ actor: actorFor(admin), projectId: proj.id, columnId: canceled.id });

    expect(result).toEqual({ ok: false, error: "refused", refusal: "last_canceled_kind" });
    const after = await testDb.select().from(boardColumn).where(eq(boardColumn.projectId, proj.id));
    expect(after).toHaveLength(5);
  });

  it("refuses the last done-kind column, and writes nothing", async () => {
    const { admin, proj, columns } = await seededProject();
    const done = columnNamed(columns, "Done");

    const result = await deleteColumn({ actor: actorFor(admin), projectId: proj.id, columnId: done.id });

    expect(result).toEqual({ ok: false, error: "refused", refusal: "last_done_kind" });
    const after = await testDb.select().from(boardColumn).where(eq(boardColumn.projectId, proj.id));
    expect(after).toHaveLength(5);
  });

  it("refuses a non-empty last column as holds_issues, all four booleans being computed first", async () => {
    const admin = await insertUser({ role: "admin" });
    const proj = await insertProject();
    const only = await insertColumn(proj.id, { name: "Done", kind: "done", sortOrder: "a0" });
    await insertIssue(proj.id, only.id, admin.id, 1);

    const result = await deleteColumn({ actor: actorFor(admin), projectId: proj.id, columnId: only.id });

    expect(result).toEqual({ ok: false, error: "refused", refusal: "holds_issues" });
  });

  it("lets one of two done-kind columns go, the restriction being on the last of a kind", async () => {
    const { admin, proj, columns } = await seededProject();
    const done = columnNamed(columns, "Done");
    await insertColumn(proj.id, { name: "Shipped", kind: "done", sortOrder: "a5" });

    const result = await deleteColumn({ actor: actorFor(admin), projectId: proj.id, columnId: done.id });

    expect(result).toEqual({ ok: true });
    const after = await testDb.select().from(boardColumn).where(eq(boardColumn.projectId, proj.id));
    expect(after.map((column) => column.name).sort()).toEqual([
      "Backlog",
      "Canceled",
      "In Progress",
      "Shipped",
      "Todo",
    ]);
  });

  it("returns not_found, never forbidden, for a column removed before the locked read", async () => {
    const { admin, proj, columns } = await seededProject();
    const todo = columnNamed(columns, "Todo");
    await testDb.delete(boardColumn).where(eq(boardColumn.id, todo.id));

    const result = await deleteColumn({ actor: actorFor(admin), projectId: proj.id, columnId: todo.id });

    expect(result).toEqual({ ok: false, error: "not_found" });
  });

  it("refuses a non-admin caller with the control bypassed, member or not", async () => {
    const proj = await insertProject();
    const columns = await insertSeedColumns(proj.id);
    const todo = columnNamed(columns, "Todo");
    const member = await insertUser({ role: "member" });
    const now = new Date();
    await testDb
      .insert(projectMember)
      .values({ projectId: proj.id, userId: member.id, createdAt: now, updatedAt: now });
    const outsider = await insertUser({ role: "member" });

    await expect(
      deleteColumn({ actor: actorFor(member), projectId: proj.id, columnId: todo.id }),
    ).resolves.toEqual({ ok: false, error: "forbidden" });
    await expect(
      deleteColumn({ actor: actorFor(outsider), projectId: proj.id, columnId: todo.id }),
    ).resolves.toEqual({ ok: false, error: "forbidden" });
    const after = await testDb.select().from(boardColumn).where(eq(boardColumn.projectId, proj.id));
    expect(after).toHaveLength(5);
  });

  it("works on an archived project", async () => {
    const admin = await insertUser({ role: "admin" });
    const proj = await insertProject({ status: "archived" });
    const columns = await insertSeedColumns(proj.id);
    const todo = columnNamed(columns, "Todo");

    const result = await deleteColumn({ actor: actorFor(admin), projectId: proj.id, columnId: todo.id });

    expect(result).toEqual({ ok: true });
    const survivor = await testDb
      .select()
      .from(boardColumn)
      .where(and(eq(boardColumn.projectId, proj.id), eq(boardColumn.id, todo.id)));
    expect(survivor).toHaveLength(0);
  });
});

describe("deleteColumn's activity row (FR-045, FR-046, FR-048)", () => {
  it("writes one column_deleted row on the project's feed, naming the column at delete time", async () => {
    const { admin, proj, columns } = await seededProject();
    const todo = columnNamed(columns, "Todo");
    await testDb.update(boardColumn).set({ name: "Up next" }).where(eq(boardColumn.id, todo.id));

    await deleteColumn({ actor: actorFor(admin), projectId: proj.id, columnId: todo.id });

    const rows = await testDb.select().from(activity).where(eq(activity.projectId, proj.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        type: "column_deleted",
        actorId: admin.id,
        projectId: proj.id,
        issueId: null,
        field: "Up next",
        fromValue: null,
        toValue: null,
      }),
    );
  });

  it("writes the activity row in the same transaction as the DELETE", () => {
    const source = readFileSync(join(__dirname, "delete-column.ts"), "utf8");

    expect(source).toContain("writeActivity(tx, {");
    expect(source).toContain('type: "column_deleted"');
  });

  it("writes no activity row for any of the four refusals", async () => {
    const { admin, proj, columns } = await seededProject();
    const todo = columnNamed(columns, "Todo");
    await insertIssue(proj.id, todo.id, admin.id, 1);
    const actor = actorFor(admin);

    await deleteColumn({ actor, projectId: proj.id, columnId: todo.id });
    await deleteColumn({ actor, projectId: proj.id, columnId: columnNamed(columns, "Done").id });
    await deleteColumn({ actor, projectId: proj.id, columnId: columnNamed(columns, "Canceled").id });

    const soloProject = await insertProject();
    const only = await insertColumn(soloProject.id, { name: "Backlog", kind: "open", sortOrder: "a0" });
    await deleteColumn({ actor, projectId: soloProject.id, columnId: only.id });

    expect(await testDb.select().from(activity)).toEqual([]);
  });

  it("writes no activity row for not_found or forbidden", async () => {
    const { admin, proj, columns } = await seededProject();
    const todo = columnNamed(columns, "Todo");
    const member = await insertUser({ role: "member" });
    await testDb.delete(boardColumn).where(eq(boardColumn.id, todo.id));

    await deleteColumn({ actor: actorFor(admin), projectId: proj.id, columnId: todo.id });
    await deleteColumn({
      actor: actorFor(member),
      projectId: proj.id,
      columnId: columnNamed(columns, "Backlog").id,
    });

    expect(await testDb.select().from(activity)).toEqual([]);
  });
});