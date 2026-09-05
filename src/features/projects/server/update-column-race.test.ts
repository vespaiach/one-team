import { asc, eq } from "drizzle-orm";
import postgres from "postgres";
import { describe, expect, it, vi } from "vitest";
import { activity, boardColumn, project, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import type { Actor } from "@/features/auth/server/actor";
import { SEED_COLUMNS } from "../seed-columns";
import { updateColumn } from "./update-column";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

function requireTestDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error("TEST_DATABASE_URL is not set");
  }
  return url;
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
  const now = new Date(Date.now() - 60_000);
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
    throw new Error("insertSeededProject produced no row");
  }
  await testDb
    .insert(boardColumn)
    .values(SEED_COLUMNS.map((column) => ({ ...column, projectId: row.id, createdAt: now, updatedAt: now })));
  return row;
}

async function columnNamed(projectId: string, name: string) {
  const rows = await testDb
    .select()
    .from(boardColumn)
    .where(eq(boardColumn.projectId, projectId))
    .orderBy(asc(boardColumn.sortOrder));
  const row = rows.find((column) => column.name === name);
  if (!row) {
    throw new Error(`no column named ${name}`);
  }
  return row;
}

describe("updateColumn — two admins renaming two columns to one name at once (FR-051, OT-INV-016)", () => {
  it("lets exactly one commit and refuses the other with the same duplicate_name a create is refused with", async () => {
    await truncateTestDatabase();
    const admin = await insertAdmin();
    const proj = await insertSeededProject();
    const todo = await columnNamed(proj.id, "Todo");
    const backlog = await columnNamed(proj.id, "Backlog");

    const heldConnection = postgres(requireTestDatabaseUrl(), { max: 1 });
    try {
      await heldConnection`BEGIN`;
      await heldConnection`UPDATE board_column SET name = 'Review', updated_at = now() WHERE id = ${todo.id}`;

      const loser = updateColumn({ actor: actorFor(admin), columnId: backlog.id, name: "Review" });
      await new Promise((resolve) => setTimeout(resolve, 200));
      await heldConnection`COMMIT`;

      expect(await loser).toEqual({
        ok: false,
        error: "duplicate_name",
        holder: { id: todo.id, name: "Review" },
      });
    } finally {
      await heldConnection.end();
    }

    const rows = await testDb.select().from(boardColumn).where(eq(boardColumn.projectId, proj.id));
    expect(rows.filter((row) => row.name === "Review")).toHaveLength(1);
    expect(rows.find((row) => row.id === todo.id)?.name).toBe("Review");
  });

  it("leaves the loser's column with its original name, no updated_at touch and no column_renamed row", async () => {
    await truncateTestDatabase();
    const admin = await insertAdmin();
    const proj = await insertSeededProject();
    const todo = await columnNamed(proj.id, "Todo");
    const backlog = await columnNamed(proj.id, "Backlog");

    const heldConnection = postgres(requireTestDatabaseUrl(), { max: 1 });
    try {
      await heldConnection`BEGIN`;
      await heldConnection`UPDATE board_column SET name = 'Review', updated_at = now() WHERE id = ${todo.id}`;

      const loser = updateColumn({ actor: actorFor(admin), columnId: backlog.id, name: "Review" });
      await new Promise((resolve) => setTimeout(resolve, 200));
      await heldConnection`COMMIT`;
      expect((await loser).ok).toBe(false);
    } finally {
      await heldConnection.end();
    }

    const [loserRow] = await testDb.select().from(boardColumn).where(eq(boardColumn.id, backlog.id));
    expect(loserRow).toEqual(backlog);
    expect(await testDb.select().from(activity)).toHaveLength(0);
  });

  it("raises PostgreSQL 23505 on the second write, asserted on the SQLSTATE", async () => {
    await truncateTestDatabase();
    const proj = await insertSeededProject();
    const todo = await columnNamed(proj.id, "Todo");
    const backlog = await columnNamed(proj.id, "Backlog");

    const first = postgres(requireTestDatabaseUrl(), { max: 1 });
    const second = postgres(requireTestDatabaseUrl(), { max: 1 });
    try {
      await first`BEGIN`;
      await first`UPDATE board_column SET name = 'Review', updated_at = now() WHERE id = ${todo.id}`;

      await second`BEGIN`;
      const blocked = second`UPDATE board_column SET name = 'Review', updated_at = now() WHERE id = ${backlog.id}`;
      await new Promise((resolve) => setTimeout(resolve, 200));
      await first`COMMIT`;

      const code = await blocked.then(
        () => null,
        (error: { code?: string }) => error.code,
      );
      expect(code).toBe("23505");
      await second`ROLLBACK`;
    } finally {
      await first.end();
      await second.end();
    }

    const rows = await testDb.select().from(boardColumn).where(eq(boardColumn.projectId, proj.id));
    expect(rows.filter((row) => row.name === "Review")).toHaveLength(1);
  });
});