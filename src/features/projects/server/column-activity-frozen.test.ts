import { and, asc, eq, inArray } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { activity, boardColumn, issueCounter, project, user } from "@/db/schema";
import { testDb, testSql, truncateTestDatabase } from "@/db/test-database";
import type { Actor } from "@/features/auth/server/actor";
import { SEED_COLUMNS } from "../seed-columns";
import { createColumn } from "./create-column";
import { deleteColumn } from "./delete-column";
import { moveColumn } from "./move-column";
import { updateColumn } from "./update-column";

beforeEach(async () => {
  await truncateTestDatabase();
});

async function insertUser() {
  const now = new Date();
  const [row] = await testDb
    .insert(user)
    .values({
      firstName: "Ada",
      lastName: "Lovelace",
      email: `ada-${crypto.randomUUID()}@example.com`,
      role: "admin",
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

async function columnNamed(projectId: string, name: string) {
  const [found] = await testDb
    .select()
    .from(boardColumn)
    .where(and(eq(boardColumn.projectId, projectId), eq(boardColumn.name, name)));
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

async function writeTheFourRows(proj: { id: string; key: string }, actor: Actor) {
  const created = await createColumn({ actor, projectKey: proj.key, name: "Review" });
  if (!created.ok) {
    throw new Error("createColumn refused");
  }
  await updateColumn({ actor, columnId: created.column.id, name: "In Review" });
  const canceled = await columnNamed(proj.id, "Canceled");
  await moveColumn({
    actor,
    columnId: created.column.id,
    targetColumnId: canceled.id,
    placement: "before",
  });
  await deleteColumn({ actor, projectId: proj.id, columnId: created.column.id });
  return created.column.id;
}

function wordingOf(rows: (typeof activity.$inferSelect)[]) {
  return rows.map((row) => ({
    type: row.type,
    field: row.field,
    fromValue: row.fromValue,
    toValue: row.toValue,
  }));
}

const THE_FOUR_ROWS = [
  { type: "column_added", field: "Review", fromValue: null, toValue: null },
  { type: "column_renamed", field: "Review", fromValue: "Review", toValue: "In Review" },
  { type: "column_reordered", field: "In Review", fromValue: null, toValue: "Done" },
  { type: "column_deleted", field: "In Review", fromValue: null, toValue: null },
];

describe("a written column activity row is frozen (FR-045, FR-048, SC-012, US5-8)", () => {
  it("keeps a row's wording after the column it names is renamed again", async () => {
    const actor = actorFor(await insertUser());
    const proj = await insertSeededProject();

    const created = await createColumn({ actor, projectKey: proj.key, name: "Review" });
    if (!created.ok) {
      throw new Error("createColumn refused");
    }
    await updateColumn({ actor, columnId: created.column.id, name: "In Review" });
    const before = wordingOf(await activityRowsOf(proj.id));

    await updateColumn({ actor, columnId: created.column.id, name: "Ready" });

    const after = await activityRowsOf(proj.id);
    expect(wordingOf(after).slice(0, 2)).toEqual(before);
  });

  it("keeps every row's wording after the column it names is deleted outright", async () => {
    const actor = actorFor(await insertUser());
    const proj = await insertSeededProject();

    await writeTheFourRows(proj, actor);

    expect(wordingOf(await activityRowsOf(proj.id))).toEqual(THE_FOUR_ROWS);
    expect(await testDb.select().from(boardColumn).where(eq(boardColumn.projectId, proj.id))).toHaveLength(5);
  });

  it("keeps every row's wording after the project's other columns are renamed", async () => {
    const actor = actorFor(await insertUser());
    const proj = await insertSeededProject();
    await writeTheFourRows(proj, actor);
    const frozenIds = (await activityRowsOf(proj.id)).map((row) => row.id);

    const done = await columnNamed(proj.id, "Done");
    await updateColumn({ actor, columnId: done.id, name: "Shipped" });
    const canceled = await columnNamed(proj.id, "Canceled");
    await updateColumn({ actor, columnId: canceled.id, name: "Dropped" });

    const frozenRows = await testDb
      .select()
      .from(activity)
      .where(inArray(activity.id, frozenIds))
      .orderBy(asc(activity.createdAt), asc(activity.id));
    expect(wordingOf(frozenRows)).toEqual(THE_FOUR_ROWS);
  });

  it("carries no reference to the column, which is why it survives that column's deletion", async () => {
    const referencedTables = await testSql<{ referenced_table: string }[]>`
      select distinct ccu.table_name as referenced_table
      from information_schema.table_constraints tc
      join information_schema.constraint_column_usage ccu
        on ccu.constraint_name = tc.constraint_name
      where tc.table_name = 'activity' and tc.constraint_type = 'FOREIGN KEY'
    `;

    const tables = referencedTables.map((row) => row.referenced_table).sort();
    expect(tables).toEqual(["comment", "issue", "project", "user"]);
    expect(tables).not.toContain("board_column");
  });
});

describe("no path but the project's cascade touches a written column activity row (FR-048, OT-INV-011)", () => {
  it("leaves every written row byte-identical across every later column edit", async () => {
    const actor = actorFor(await insertUser());
    const proj = await insertSeededProject();
    await writeTheFourRows(proj, actor);
    const frozenRows = await activityRowsOf(proj.id);
    const frozenIds = frozenRows.map((row) => row.id);

    const added = await createColumn({ actor, projectKey: proj.key, name: "Blocked" });
    if (!added.ok) {
      throw new Error("createColumn refused");
    }
    await updateColumn({ actor, columnId: added.column.id, name: "On Hold" });
    const backlog = await columnNamed(proj.id, "Backlog");
    await moveColumn({
      actor,
      columnId: added.column.id,
      targetColumnId: backlog.id,
      placement: "before",
    });
    await deleteColumn({ actor, projectId: proj.id, columnId: added.column.id });

    const stillThere = await testDb
      .select()
      .from(activity)
      .where(inArray(activity.id, frozenIds))
      .orderBy(asc(activity.createdAt), asc(activity.id));
    expect(stillThere).toEqual(frozenRows);
  });

  it("removes the rows only when the project they belong to is deleted", async () => {
    const actor = actorFor(await insertUser());
    const proj = await insertSeededProject();
    await writeTheFourRows(proj, actor);
    expect(await activityRowsOf(proj.id)).toHaveLength(4);

    await testDb.delete(project).where(eq(project.id, proj.id));

    expect(await activityRowsOf(proj.id)).toHaveLength(0);
  });
});