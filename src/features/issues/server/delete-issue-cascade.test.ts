import { eq } from "drizzle-orm";
import postgres from "postgres";
import { beforeEach, describe, expect, it } from "vitest";
import { boardColumn, issue, project, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import type { Actor } from "@/features/auth/server/actor";
import { deleteIssue } from "./delete-issue";

function requireTestDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error("TEST_DATABASE_URL is not set");
  }
  return url;
}

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

async function insertProjectWithColumn() {
  const now = new Date();
  const [proj] = await testDb
    .insert(project)
    .values({
      key: `P${crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      name: "Website Redesign",
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!proj) {
    throw new Error("insertProject produced no row");
  }
  const [column] = await testDb
    .insert(boardColumn)
    .values({
      projectId: proj.id,
      name: "Backlog",
      kind: "open",
      sortOrder: "a0",
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!column) {
    throw new Error("insertColumn produced no row");
  }
  return { proj, column };
}

function actorFor(userRow: { id: string; role: string; firstName: string; lastName: string }): Actor {
  return {
    id: userRow.id,
    role: userRow.role,
    firstName: userRow.firstName,
    lastName: userRow.lastName,
    avatarUrl: null,
    mustChangePassword: false,
  };
}

async function insertIssue(projectId: string, columnId: string, createdBy: string) {
  const now = new Date();
  const [row] = await testDb
    .insert(issue)
    .values({
      projectId,
      number: 1,
      title: "Fix the header",
      columnId,
      createdBy,
      sortOrder: "a0",
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!row) {
    throw new Error("insertIssue produced no row");
  }
  return row;
}

describe("deleteIssue — the cascade reaches nothing today (FR-059, SC-011, US5 s1)", () => {
  it("removes the issue alone, leaving its project and column untouched", async () => {
    const { proj, column } = await insertProjectWithColumn();
    const admin = await insertUser({ role: "admin" });
    const created = await insertIssue(proj.id, column.id, admin.id);

    const result = await deleteIssue({ issueId: created.id, actor: actorFor(admin) });

    expect(result).toEqual({ status: "ok" });
    const projectRows = await testDb.select().from(project).where(eq(project.id, proj.id));
    expect(projectRows).toHaveLength(1);
    const columnRows = await testDb.select().from(boardColumn).where(eq(boardColumn.id, column.id));
    expect(columnRows).toHaveLength(1);
  });

  it("is visible as committed from a second connection outside the transaction once deleteIssue resolves", async () => {
    const { proj, column } = await insertProjectWithColumn();
    const admin = await insertUser({ role: "admin" });
    const created = await insertIssue(proj.id, column.id, admin.id);

    const result = await deleteIssue({ issueId: created.id, actor: actorFor(admin) });
    expect(result).toEqual({ status: "ok" });

    const secondConnection = postgres(requireTestDatabaseUrl(), { max: 1 });
    try {
      const rows = await secondConnection`SELECT id FROM issue WHERE id = ${created.id}`;
      expect(rows).toHaveLength(0);
    } finally {
      await secondConnection.end();
    }
  });
});