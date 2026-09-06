import { beforeEach, describe, expect, it } from "vitest";
import { boardColumn, issue, notification, project, projectMember, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import type { Actor } from "@/features/auth/server/actor";
import { createComment } from "./create-comment";

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

async function insertIssueRow(projectId: string, createdBy: string, assigneeId: string | null) {
  const now = new Date();
  const [column] = await testDb
    .insert(boardColumn)
    .values({
      projectId,
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
  const [row] = await testDb
    .insert(issue)
    .values({
      projectId,
      number: 1,
      title: "Fix the header",
      columnId: column.id,
      createdBy,
      assigneeId,
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

async function census() {
  return testDb.select().from(notification);
}

describe("createComment — an issue comment (FR-041, FR-043, FR-047, SC-003)", () => {
  it("writes a mention row for each name and a comment row for the listeners it has not already reached", async () => {
    const proj = await insertProject();
    const author = await insertUser();
    const creator = await insertUser();
    const assignee = await insertUser();
    const named = await insertUser();
    for (const person of [author, creator, assignee, named]) {
      await addMember(proj.id, person.id);
    }
    const issueRow = await insertIssueRow(proj.id, creator.id, assignee.id);
    const before = await census();

    const result = await createComment({
      target: { issueId: issueRow.id },
      actor: actorFor(author),
      body: `@[${named.id}] @[${assignee.id}] please look`,
    });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") {
      throw new Error("expected an ok result");
    }
    const after = await census();
    expect(after).toHaveLength(before.length + 3);
    const byUser = new Map(after.map((row) => [row.userId, row]));
    expect(byUser.get(named.id)?.type).toBe("mention");
    expect(byUser.get(assignee.id)?.type).toBe("mention");
    expect(byUser.get(creator.id)?.type).toBe("comment");
    expect(byUser.has(author.id)).toBe(false);
    for (const row of after) {
      expect(row).toMatchObject({
        actorId: author.id,
        issueId: issueRow.id,
        projectId: null,
        commentId: result.comment.id,
        sendAttempts: 0,
        readAt: null,
      });
    }
  });
});

describe("createComment — a project comment (FR-048, SC-003)", () => {
  it("writes a comment row for each explicit member and carries the project as the target", async () => {
    const proj = await insertProject();
    const author = await insertUser();
    const memberOne = await insertUser();
    const memberTwo = await insertUser();
    for (const person of [author, memberOne, memberTwo]) {
      await addMember(proj.id, person.id);
    }
    const before = await census();

    const result = await createComment({
      target: { projectId: proj.id },
      actor: actorFor(author),
      body: "Kicking this off.",
    });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") {
      throw new Error("expected an ok result");
    }
    const after = await census();
    expect(after).toHaveLength(before.length + 2);
    expect(new Set(after.map((row) => row.userId))).toEqual(new Set([memberOne.id, memberTwo.id]));
    for (const row of after) {
      expect(row).toMatchObject({
        type: "comment",
        actorId: author.id,
        issueId: null,
        projectId: proj.id,
        commentId: result.comment.id,
      });
    }
  });
});