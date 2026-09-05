import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { boardColumn, issue, project, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import type { Actor } from "@/features/auth/server/actor";
import { deleteColumn } from "./delete-column";

function requireTestDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error("TEST_DATABASE_URL is not set");
  }
  return url;
}

const secondConnection = postgres(requireTestDatabaseUrl(), { max: 2 });
const secondDb = drizzle(secondConnection, { schema });

afterAll(async () => {
  await secondConnection.end();
});

beforeEach(async () => {
  await truncateTestDatabase();
});

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

async function insertAdmin() {
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
    throw new Error("insertAdmin produced no row");
  }
  return row;
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

async function insertColumns(projectId: string, values: { name: string; kind: string; sortOrder: string }[]) {
  const now = new Date();
  return await testDb
    .insert(boardColumn)
    .values(values.map((value) => ({ projectId, ...value, createdAt: now, updatedAt: now })))
    .returning();
}

function columnNamed(rows: (typeof boardColumn.$inferSelect)[], name: string) {
  const row = rows.find((column) => column.name === name);
  if (!row) {
    throw new Error(`no column named ${name}`);
  }
  return row;
}

function settle(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

describe("deleteColumn under real concurrency (FR-050, SC-003, SC-005)", () => {
  it("refuses holds_issues when an issue lands in the column between the emptiness read and the delete", async () => {
    const admin = await insertAdmin();
    const proj = await insertProject();
    const columns = await insertColumns(proj.id, [
      { name: "Backlog", kind: "open", sortOrder: "a0" },
      { name: "Todo", kind: "open", sortOrder: "a1" },
      { name: "Done", kind: "done", sortOrder: "a2" },
      { name: "Canceled", kind: "canceled", sortOrder: "a3" },
    ]);
    const todo = columnNamed(columns, "Todo");

    let announceInserted = () => {};
    const inserted = new Promise<void>((resolve) => {
      announceInserted = resolve;
    });
    let releaseWriter = () => {};
    const released = new Promise<void>((resolve) => {
      releaseWriter = resolve;
    });

    const writer = secondDb.transaction(async (tx) => {
      const now = new Date();
      await tx.insert(issue).values({
        projectId: proj.id,
        number: 1,
        title: "Fix the header",
        columnId: todo.id,
        createdBy: admin.id,
        sortOrder: "a0",
        createdAt: now,
        updatedAt: now,
      });
      announceInserted();
      await released;
    });

    await inserted;
    const deleting = deleteColumn({ actor: actorFor(admin), projectId: proj.id, columnId: todo.id });
    await settle(150);
    releaseWriter();
    await writer;

    await expect(deleting).resolves.toEqual({ ok: false, error: "refused", refusal: "holds_issues" });
    const survivors = await testDb.select().from(boardColumn).where(eq(boardColumn.projectId, proj.id));
    expect(survivors.map((column) => column.id)).toContain(todo.id);
    const issues = await testDb.select().from(issue).where(eq(issue.projectId, proj.id));
    expect(issues).toHaveLength(1);
  });

  it("lets one of two concurrent deletes of the last two done-kind columns through, refusing the other", async () => {
    const admin = await insertAdmin();
    const proj = await insertProject();
    const columns = await insertColumns(proj.id, [
      { name: "Backlog", kind: "open", sortOrder: "a0" },
      { name: "Done", kind: "done", sortOrder: "a1" },
      { name: "Shipped", kind: "done", sortOrder: "a2" },
      { name: "Canceled", kind: "canceled", sortOrder: "a3" },
    ]);
    const done = columnNamed(columns, "Done");
    const shipped = columnNamed(columns, "Shipped");

    let announceHeld = () => {};
    const held = new Promise<void>((resolve) => {
      announceHeld = resolve;
    });
    let releaseHolder = () => {};
    const released = new Promise<void>((resolve) => {
      releaseHolder = resolve;
    });

    const holder = secondDb.transaction(async (tx) => {
      await tx.select().from(boardColumn).where(eq(boardColumn.projectId, proj.id)).for("update");
      announceHeld();
      await released;
    });

    await held;
    const first = deleteColumn({ actor: actorFor(admin), projectId: proj.id, columnId: done.id });
    const second = deleteColumn({ actor: actorFor(admin), projectId: proj.id, columnId: shipped.id });
    await settle(150);
    releaseHolder();
    await holder;

    const results = await Promise.all([first, second]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toEqual([
      { ok: false, error: "refused", refusal: "last_done_kind" },
    ]);
    const survivors = await testDb.select().from(boardColumn).where(eq(boardColumn.projectId, proj.id));
    expect(survivors.filter((column) => column.kind === "done")).toHaveLength(1);
  });
});