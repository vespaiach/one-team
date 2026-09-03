import { eq } from "drizzle-orm";
import postgres from "postgres";
import { describe, expect, it } from "vitest";
import { boardColumn, issue, project, projectMember, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import type { Actor } from "@/features/auth/server/actor";
import { updateIssue } from "./update-issue";

function requireTestDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error("TEST_DATABASE_URL is not set");
  }
  return url;
}

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

async function addMember(projectId: string, userId: string) {
  const now = new Date();
  await testDb.insert(projectMember).values({ projectId, userId, createdAt: now, updatedAt: now });
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

describe("updateIssue — two members editing the same field concurrently (FR-064, SC-019, edge case: two members editing)", () => {
  it("neither writer is refused for the conflict, and the later-committing write is what a subsequent reader sees", async () => {
    await truncateTestDatabase();
    const { proj, column } = await insertProjectWithColumn();
    const member = await insertUser();
    await addMember(proj.id, member.id);
    const created = await insertIssue(proj.id, column.id, member.id);

    const heldConnection = postgres(requireTestDatabaseUrl(), { max: 1 });
    try {
      await heldConnection`BEGIN`;
      await heldConnection`SELECT * FROM issue WHERE id = ${created.id} FOR UPDATE`;

      const firstWriter = updateIssue({
        issueId: created.id,
        actor: actorFor(member),
        title: "First writer",
      });

      await new Promise((resolve) => setTimeout(resolve, 100));
      await heldConnection`COMMIT`;

      const firstResult = await firstWriter;
      expect(firstResult.status).toBe("ok");

      const secondResult = await updateIssue({
        issueId: created.id,
        actor: actorFor(member),
        title: "Second writer",
      });
      expect(secondResult.status).toBe("ok");

      const [row] = await testDb.select().from(issue).where(eq(issue.id, created.id));
      expect(row?.title).toBe("Second writer");
    } finally {
      await heldConnection.end();
    }
  });

  it("two racing saves of the same field on two separate connections both succeed, and the stored value is one of the two, never corrupted", async () => {
    await truncateTestDatabase();
    const { proj, column } = await insertProjectWithColumn();
    const member = await insertUser();
    await addMember(proj.id, member.id);
    const created = await insertIssue(proj.id, column.id, member.id);

    const [first, second] = await Promise.all([
      updateIssue({ issueId: created.id, actor: actorFor(member), priority: "high" }),
      updateIssue({ issueId: created.id, actor: actorFor(member), priority: "urgent" }),
    ]);

    expect(first.status).toBe("ok");
    expect(second.status).toBe("ok");

    const [row] = await testDb.select().from(issue).where(eq(issue.id, created.id));
    expect(["high", "urgent"]).toContain(row?.priority);
  });
});