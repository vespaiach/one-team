import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { boardColumn, issue, issueCounter, notification, project, projectMember, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import type { Actor } from "@/features/auth/server/actor";
import { createIssue } from "./create-issue";

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

async function insertProjectWithColumnAndCounter() {
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
  await testDb.insert(issueCounter).values({ projectId: proj.id, lastNumber: 0 });
  return { proj, column };
}

async function addMember(projectId: string, userId: string) {
  const now = new Date();
  await testDb.insert(projectMember).values({ projectId, userId, createdAt: now, updatedAt: now });
}

function actorFor(userRow: typeof user.$inferSelect): Actor {
  return {
    id: userRow.id,
    role: userRow.role,
    firstName: userRow.firstName,
    lastName: userRow.lastName,
    avatarUrl: null,
    mustChangePassword: false,
  };
}

async function seed() {
  const { proj } = await insertProjectWithColumnAndCounter();
  const creator = await insertUser();
  const assignee = await insertUser();
  await addMember(proj.id, creator.id);
  await addMember(proj.id, assignee.id);
  return { proj, creator, assignee };
}

async function census() {
  return testDb.select().from(notification);
}

describe("createIssue — the notification row lives and dies with its transaction (FR-041, SC-010)", () => {
  it("writes the assignment row when the transaction commits", async () => {
    const { proj, creator, assignee } = await seed();
    const before = await census();

    const result = await createIssue({
      projectId: proj.id,
      actor: actorFor(creator),
      title: "Fix the header",
      description: null,
      columnId: null,
      priority: null,
      assigneeId: assignee.id,
      dueDate: null,
    });

    expect(result).toMatchObject({ status: "ok" });
    expect(await census()).toHaveLength(before.length + 1);
  });

  it("leaves no notification row and no issue row behind when the transaction rolls back", async () => {
    const { proj, creator, assignee } = await seed();
    await testDb.delete(issueCounter).where(eq(issueCounter.projectId, proj.id));
    const before = await census();

    const result = await createIssue({
      projectId: proj.id,
      actor: actorFor(creator),
      title: "Fix the header",
      description: null,
      columnId: null,
      priority: null,
      assigneeId: assignee.id,
      dueDate: null,
    });

    expect(result).toEqual({ status: "no-counter" });
    expect(await census()).toEqual(before);
    expect(await testDb.select().from(issue).where(eq(issue.projectId, proj.id))).toEqual([]);
  });
});