import { asc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { activity, boardColumn, issue, issueCounter, project, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import type { Actor } from "@/features/auth/server/actor";
import { SEED_COLUMNS } from "../seed-columns";
import { createColumn } from "./create-column";
import { deleteColumn } from "./delete-column";
import { moveColumn } from "./move-column";
import { updateColumn } from "./update-column";

const ACTIVITY_VALUE_MAX_LENGTH = 200;

beforeEach(async () => {
  await truncateTestDatabase();
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

async function insertSeededProject() {
  const now = new Date();
  const [row] = await testDb
    .insert(project)
    .values({
      key: `P${crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      name: "Website Redesign",
      status: "active",
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
  const columns = await columnsOf(projectId);
  const found = columns.find((column) => column.name === name);
  if (!found) {
    throw new Error(`no column named ${name}`);
  }
  return found;
}

async function activityRowsOf(projectId: string) {
  return testDb
    .select()
    .from(activity)
    .where(eq(activity.projectId, projectId))
    .orderBy(asc(activity.createdAt), asc(activity.id));
}

async function insertIssue(projectId: string, columnId: string, createdBy: string) {
  const now = new Date();
  await testDb.insert(issue).values({
    projectId,
    number: 1,
    title: "An issue",
    columnId,
    createdBy,
    sortOrder: "a0",
    createdAt: now,
    updatedAt: now,
  });
}

describe("column activity — the four rows the four edits write (FR-045, FR-046, FR-047, SC-011, US5-1…US5-4)", () => {
  it("writes exactly four rows, in edit order, each naming the actor and the column it describes", async () => {
    const admin = await insertUser("admin");
    const actor = actorFor(admin);
    const proj = await insertSeededProject();

    const created = await createColumn({ actor, projectKey: proj.key, name: "Review" });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      throw new Error("createColumn refused");
    }

    expect(await updateColumn({ actor, columnId: created.column.id, name: "In Review" })).toEqual({
      ok: true,
    });

    const canceled = await columnNamed(proj.id, "Canceled");
    expect(
      await moveColumn({
        actor,
        columnId: created.column.id,
        targetColumnId: canceled.id,
        placement: "before",
      }),
    ).toEqual({ ok: true });

    expect(await deleteColumn({ actor, projectId: proj.id, columnId: created.column.id })).toEqual({
      ok: true,
    });

    const rows = await activityRowsOf(proj.id);

    expect(rows).toHaveLength(4);
    expect(rows.map((row) => row.type)).toEqual([
      "column_added",
      "column_renamed",
      "column_reordered",
      "column_deleted",
    ]);
    expect(rows.map((row) => row.actorId)).toEqual([admin.id, admin.id, admin.id, admin.id]);
    expect(rows.map((row) => ({ field: row.field, fromValue: row.fromValue, toValue: row.toValue }))).toEqual(
      [
        { field: "Review", fromValue: null, toValue: null },
        { field: "Review", fromValue: "Review", toValue: "In Review" },
        { field: "In Review", fromValue: null, toValue: "Done" },
        { field: "In Review", fromValue: null, toValue: null },
      ],
    );
  });

  it("attaches every row to the project and to no issue and no comment", async () => {
    const admin = await insertUser("admin");
    const actor = actorFor(admin);
    const proj = await insertSeededProject();

    const created = await createColumn({ actor, projectKey: proj.key, name: "Review" });
    if (!created.ok) {
      throw new Error("createColumn refused");
    }
    await updateColumn({ actor, columnId: created.column.id, name: "In Review" });
    await deleteColumn({ actor, projectId: proj.id, columnId: created.column.id });

    const rows = await activityRowsOf(proj.id);

    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.projectId).toBe(proj.id);
      expect(row.issueId).toBeNull();
      expect(row.commentId).toBeNull();
    }
  });

  it("carries a null to_value on a reorder that makes the column first", async () => {
    const admin = await insertUser("admin");
    const actor = actorFor(admin);
    const proj = await insertSeededProject();
    const backlog = await columnNamed(proj.id, "Backlog");
    const canceled = await columnNamed(proj.id, "Canceled");

    expect(
      await moveColumn({ actor, columnId: canceled.id, targetColumnId: backlog.id, placement: "before" }),
    ).toEqual({ ok: true });

    const rows = await activityRowsOf(proj.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: "column_reordered",
      field: "Canceled",
      fromValue: null,
      toValue: null,
    });
  });

  it("writes one row for the column the drag moved, not one per column whose ordinal shifted", async () => {
    const admin = await insertUser("admin");
    const actor = actorFor(admin);
    const proj = await insertSeededProject();
    const backlog = await columnNamed(proj.id, "Backlog");
    const canceled = await columnNamed(proj.id, "Canceled");

    await moveColumn({ actor, columnId: canceled.id, targetColumnId: backlog.id, placement: "before" });

    const rows = await activityRowsOf(proj.id);
    expect(rows).toHaveLength(1);
    expect(rows.map((row) => row.field)).toEqual(["Canceled"]);
  });

  it("keeps every written value inside the 200-character bound truncateActivityValue enforces", async () => {
    const admin = await insertUser("admin");
    const actor = actorFor(admin);
    const proj = await insertSeededProject();
    const longName = "R".repeat(ACTIVITY_VALUE_MAX_LENGTH);
    const longerRename = "E".repeat(ACTIVITY_VALUE_MAX_LENGTH);

    const created = await createColumn({ actor, projectKey: proj.key, name: longName });
    if (!created.ok) {
      throw new Error("createColumn refused");
    }
    expect(await updateColumn({ actor, columnId: created.column.id, name: longerRename })).toEqual({
      ok: true,
    });

    const rows = await activityRowsOf(proj.id);
    expect(rows.map((row) => ({ field: row.field, fromValue: row.fromValue, toValue: row.toValue }))).toEqual(
      [
        { field: longName, fromValue: null, toValue: null },
        { field: longName, fromValue: longName, toValue: longerRename },
      ],
    );
    for (const row of rows) {
      for (const value of [row.field, row.fromValue, row.toValue]) {
        expect((value ?? "").length).toBeLessThanOrEqual(ACTIVITY_VALUE_MAX_LENGTH);
      }
    }
  });
});

describe("column activity — a refused edit writes no row (FR-048, SC-011, US5-5)", () => {
  it("writes none when a create collides with an existing name", async () => {
    const admin = await insertUser("admin");
    const proj = await insertSeededProject();

    const result = await createColumn({ actor: actorFor(admin), projectKey: proj.key, name: "todo" });

    expect(result.ok).toBe(false);
    expect(await activityRowsOf(proj.id)).toHaveLength(0);
  });

  it("writes none when a rename collides with an existing name", async () => {
    const admin = await insertUser("admin");
    const proj = await insertSeededProject();
    const backlog = await columnNamed(proj.id, "Backlog");

    const result = await updateColumn({ actor: actorFor(admin), columnId: backlog.id, name: "Todo" });

    expect(result.ok).toBe(false);
    expect(await activityRowsOf(proj.id)).toHaveLength(0);
  });

  it("writes none when a rename changes nothing", async () => {
    const admin = await insertUser("admin");
    const proj = await insertSeededProject();
    const backlog = await columnNamed(proj.id, "Backlog");

    const result = await updateColumn({ actor: actorFor(admin), columnId: backlog.id, name: "  Backlog  " });

    expect(result).toEqual({ ok: true });
    expect(await activityRowsOf(proj.id)).toHaveLength(0);
  });

  it("writes none when a drop leaves the column where it already sat", async () => {
    const admin = await insertUser("admin");
    const proj = await insertSeededProject();
    const backlog = await columnNamed(proj.id, "Backlog");
    const todo = await columnNamed(proj.id, "Todo");

    const result = await moveColumn({
      actor: actorFor(admin),
      columnId: todo.id,
      targetColumnId: backlog.id,
      placement: "after",
    });

    expect(result).toEqual({ ok: true });
    expect(await activityRowsOf(proj.id)).toHaveLength(0);
  });

  it("writes none when a delete is refused because the column holds issues", async () => {
    const admin = await insertUser("admin");
    const proj = await insertSeededProject();
    const backlog = await columnNamed(proj.id, "Backlog");
    await insertIssue(proj.id, backlog.id, admin.id);

    const result = await deleteColumn({
      actor: actorFor(admin),
      projectId: proj.id,
      columnId: backlog.id,
    });

    expect(result).toEqual({ ok: false, error: "refused", refusal: "holds_issues" });
    expect(await activityRowsOf(proj.id)).toHaveLength(0);
  });

  it("writes none when a delete is refused because it is the project's last column", async () => {
    const admin = await insertUser("admin");
    const proj = await insertSeededProject();
    const backlog = await columnNamed(proj.id, "Backlog");
    await testDb.delete(boardColumn).where(eq(boardColumn.projectId, proj.id));
    const now = new Date();
    await testDb
      .insert(boardColumn)
      .values({ ...backlog, projectId: proj.id, createdAt: now, updatedAt: now });

    const result = await deleteColumn({
      actor: actorFor(admin),
      projectId: proj.id,
      columnId: backlog.id,
    });

    expect(result).toEqual({ ok: false, error: "refused", refusal: "last_column" });
    expect(await activityRowsOf(proj.id)).toHaveLength(0);
  });

  it("writes none when a delete is refused because it is the project's last canceled-kind column", async () => {
    const admin = await insertUser("admin");
    const proj = await insertSeededProject();
    const canceled = await columnNamed(proj.id, "Canceled");

    const result = await deleteColumn({
      actor: actorFor(admin),
      projectId: proj.id,
      columnId: canceled.id,
    });

    expect(result).toEqual({ ok: false, error: "refused", refusal: "last_canceled_kind" });
    expect(await activityRowsOf(proj.id)).toHaveLength(0);
  });

  it("writes none when a delete is refused because it is the project's last done-kind column", async () => {
    const admin = await insertUser("admin");
    const proj = await insertSeededProject();
    const done = await columnNamed(proj.id, "Done");

    const result = await deleteColumn({ actor: actorFor(admin), projectId: proj.id, columnId: done.id });

    expect(result).toEqual({ ok: false, error: "refused", refusal: "last_done_kind" });
    expect(await activityRowsOf(proj.id)).toHaveLength(0);
  });
});