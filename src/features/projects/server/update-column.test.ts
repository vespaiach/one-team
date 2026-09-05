import { asc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { activity, boardColumn, issue, issueCounter, project, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import type { Actor } from "@/features/auth/server/actor";
import { SEED_COLUMNS } from "../seed-columns";
import { updateColumn } from "./update-column";

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

async function insertUser(role: "admin" | "member") {
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
  return row;
}

function actorFor(row: { id: string; role: string }): Actor {
  return {
    id: row.id,
    role: row.role,
    firstName: "Ada",
    lastName: "Lovelace",
    avatarUrl: null,
    mustChangePassword: false,
  };
}

async function insertSeededProject(status: "active" | "archived" = "active") {
  const now = new Date(Date.now() - 60_000);
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
    throw new Error("insertSeededProject produced no row");
  }
  await testDb.insert(issueCounter).values({ projectId: row.id, lastNumber: 0 });
  await testDb
    .insert(boardColumn)
    .values(SEED_COLUMNS.map((column) => ({ ...column, projectId: row.id, createdAt: now, updatedAt: now })));
  return row;
}

async function columnsOf(projectId: string) {
  return testDb
    .select()
    .from(boardColumn)
    .where(eq(boardColumn.projectId, projectId))
    .orderBy(asc(boardColumn.sortOrder), asc(boardColumn.id));
}

async function columnNamed(projectId: string, name: string) {
  const row = (await columnsOf(projectId)).find((column) => column.name === name);
  if (!row) {
    throw new Error(`no column named ${name}`);
  }
  return row;
}

describe("updateColumn (FR-023, FR-024, FR-026, SC-007, SC-015)", () => {
  it("writes name and updated_at and nothing else", async () => {
    const admin = await insertUser("admin");
    const proj = await insertSeededProject();
    const todo = await columnNamed(proj.id, "Todo");

    const result = await updateColumn({ actor: actorFor(admin), columnId: todo.id, name: "  Up next  " });

    expect(result).toEqual({ ok: true });
    const [after] = await testDb.select().from(boardColumn).where(eq(boardColumn.id, todo.id));
    if (!after) {
      throw new Error("column vanished");
    }
    expect(after.name).toBe("Up next");
    expect(after.kind).toBe(todo.kind);
    expect(after.sortOrder).toBe(todo.sortOrder);
    expect(after.projectId).toBe(todo.projectId);
    expect(after.createdAt).toEqual(todo.createdAt);
    expect(after.updatedAt.getTime()).toBeGreaterThan(todo.updatedAt.getTime());
  });

  it("touches no issue", async () => {
    const admin = await insertUser("admin");
    const proj = await insertSeededProject();
    const todo = await columnNamed(proj.id, "Todo");
    const now = new Date(Date.now() - 60_000);
    const [existingIssue] = await testDb
      .insert(issue)
      .values({
        projectId: proj.id,
        number: 1,
        title: "An issue",
        columnId: todo.id,
        createdBy: admin.id,
        sortOrder: "a0",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    await updateColumn({ actor: actorFor(admin), columnId: todo.id, name: "Up next" });

    const [issueAfter] = await testDb.select().from(issue).where(eq(issue.projectId, proj.id));
    expect(issueAfter).toEqual(existingIssue);
  });

  it("writes nothing at all when the submitted name equals the stored name", async () => {
    const admin = await insertUser("admin");
    const proj = await insertSeededProject();
    const todo = await columnNamed(proj.id, "Todo");

    const result = await updateColumn({ actor: actorFor(admin), columnId: todo.id, name: "  Todo  " });

    expect(result).toEqual({ ok: true });
    const [after] = await testDb.select().from(boardColumn).where(eq(boardColumn.id, todo.id));
    expect(after).toEqual(todo);
    expect(await testDb.select().from(activity)).toHaveLength(0);
  });

  it("accepts a case-only change of the column's own name", async () => {
    const admin = await insertUser("admin");
    const proj = await insertSeededProject();
    const todo = await columnNamed(proj.id, "Todo");

    const result = await updateColumn({ actor: actorFor(admin), columnId: todo.id, name: "todo" });

    expect(result).toEqual({ ok: true });
    const [after] = await testDb.select().from(boardColumn).where(eq(boardColumn.id, todo.id));
    expect(after?.name).toBe("todo");
  });

  it("calls notFound() for an unknown column id, even for a non-admin", async () => {
    const member = await insertUser("member");

    await expect(
      updateColumn({ actor: actorFor(member), columnId: crypto.randomUUID(), name: "Up next" }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it("calls notFound() for a column another admin has already deleted", async () => {
    const admin = await insertUser("admin");
    const proj = await insertSeededProject();
    const todo = await columnNamed(proj.id, "Todo");
    await testDb.delete(boardColumn).where(eq(boardColumn.id, todo.id));

    await expect(
      updateColumn({ actor: actorFor(admin), columnId: todo.id, name: "Up next" }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("refuses a non-admin with forbidden and writes nothing", async () => {
    const member = await insertUser("member");
    const proj = await insertSeededProject();
    const todo = await columnNamed(proj.id, "Todo");

    const result = await updateColumn({ actor: actorFor(member), columnId: todo.id, name: "Up next" });

    expect(result).toEqual({ ok: false, error: "forbidden" });
    const [after] = await testDb.select().from(boardColumn).where(eq(boardColumn.id, todo.id));
    expect(after).toEqual(todo);
  });

  it("refuses an empty name and a 201-character name without truncating", async () => {
    const admin = await insertUser("admin");
    const proj = await insertSeededProject();
    const todo = await columnNamed(proj.id, "Todo");

    expect(await updateColumn({ actor: actorFor(admin), columnId: todo.id, name: "   " })).toEqual({
      ok: false,
      error: "invalid_name",
      reason: "required",
    });
    expect(await updateColumn({ actor: actorFor(admin), columnId: todo.id, name: "x".repeat(201) })).toEqual({
      ok: false,
      error: "invalid_name",
      reason: "too_long",
    });
    const [after] = await testDb.select().from(boardColumn).where(eq(boardColumn.id, todo.id));
    expect(after).toEqual(todo);
  });

  it("renames on an archived project, never consulting project.status", async () => {
    const admin = await insertUser("admin");
    const proj = await insertSeededProject("archived");
    const todo = await columnNamed(proj.id, "Todo");

    expect(await updateColumn({ actor: actorFor(admin), columnId: todo.id, name: "Up next" })).toEqual({
      ok: true,
    });
  });
});

describe("updateColumn uniqueness and activity (FR-025, FR-045, FR-046)", () => {
  it("refuses a rename colliding with another column of the same project, in any casing", async () => {
    const admin = await insertUser("admin");
    const proj = await insertSeededProject();
    const todo = await columnNamed(proj.id, "Todo");
    const backlog = await columnNamed(proj.id, "Backlog");

    expect(await updateColumn({ actor: actorFor(admin), columnId: todo.id, name: "Backlog" })).toEqual({
      ok: false,
      error: "duplicate_name",
      holder: { id: backlog.id, name: "Backlog" },
    });
    expect(await updateColumn({ actor: actorFor(admin), columnId: todo.id, name: " backlog " })).toEqual({
      ok: false,
      error: "duplicate_name",
      holder: { id: backlog.id, name: "Backlog" },
    });

    const [after] = await testDb.select().from(boardColumn).where(eq(boardColumn.id, todo.id));
    expect(after).toEqual(todo);
  });

  it("allows a rename to a name held in another project", async () => {
    const admin = await insertUser("admin");
    await insertSeededProject();
    const proj = await insertSeededProject();
    const todo = await columnNamed(proj.id, "Todo");

    expect(await updateColumn({ actor: actorFor(admin), columnId: todo.id, name: "Up next" })).toEqual({
      ok: true,
    });
  });

  it("writes one column_renamed row carrying the pre-rename name in field and from_value", async () => {
    const admin = await insertUser("admin");
    const proj = await insertSeededProject();
    const todo = await columnNamed(proj.id, "Todo");

    await updateColumn({ actor: actorFor(admin), columnId: todo.id, name: "  Up next  " });

    const rows = await testDb.select().from(activity).where(eq(activity.projectId, proj.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: "column_renamed",
      actorId: admin.id,
      projectId: proj.id,
      issueId: null,
      commentId: null,
      field: "Todo",
      fromValue: "Todo",
      toValue: "Up next",
    });
  });

  it("leaves no activity row behind for a duplicate, an invalid name or a forbidden caller", async () => {
    const admin = await insertUser("admin");
    const member = await insertUser("member");
    const proj = await insertSeededProject();
    const todo = await columnNamed(proj.id, "Todo");

    await updateColumn({ actor: actorFor(admin), columnId: todo.id, name: "Backlog" });
    await updateColumn({ actor: actorFor(admin), columnId: todo.id, name: "" });
    await updateColumn({ actor: actorFor(member), columnId: todo.id, name: "Up next" });

    expect(await testDb.select().from(activity)).toHaveLength(0);
  });
});