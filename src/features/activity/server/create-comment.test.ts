import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { activity, boardColumn, comment, issue, project, projectMember, user } from "@/db/schema";
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

async function insertColumn(projectId: string) {
  const now = new Date();
  const [row] = await testDb
    .insert(boardColumn)
    .values({ projectId, name: "Backlog", kind: "open", sortOrder: "a0", createdAt: now, updatedAt: now })
    .returning();
  if (!row) {
    throw new Error("insertColumn produced no row");
  }
  return row;
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

async function fixtureWithMember() {
  const projectRow = await insertProject();
  const memberRow = await insertUser();
  await addMember(projectRow.id, memberRow.id);
  return { project: projectRow, member: memberRow };
}

describe("createComment — writes (FR-045, US1 s1, s2)", () => {
  it("writes one comment row and exactly one comment-type activity row carrying the new comment's id", async () => {
    const { project: projectRow, member } = await fixtureWithMember();

    const result = await createComment({
      target: { projectId: projectRow.id },
      actor: actorFor(member),
      body: "Looks good.",
    });

    expect(result.status).toBe("ok");
    const commentRows = await testDb.select().from(comment).where(eq(comment.projectId, projectRow.id));
    expect(commentRows).toHaveLength(1);
    expect(commentRows[0]).toMatchObject({ authorId: member.id, body: "Looks good." });

    const activityRows = await testDb.select().from(activity).where(eq(activity.projectId, projectRow.id));
    expect(activityRows).toHaveLength(1);
    expect(activityRows[0]).toMatchObject({
      type: "comment",
      actorId: member.id,
      commentId: commentRows[0]?.id,
      field: null,
      fromValue: null,
      toValue: null,
    });
  });

  it("writes an issue-scoped comment against the issue's own target", async () => {
    const { project: projectRow, member } = await fixtureWithMember();
    const column = await insertColumn(projectRow.id);
    const issueRow = await insertIssue(projectRow.id, column.id, member.id);

    const result = await createComment({
      target: { issueId: issueRow.id },
      actor: actorFor(member),
      body: "On it.",
    });

    expect(result.status).toBe("ok");
    const commentRows = await testDb.select().from(comment).where(eq(comment.issueId, issueRow.id));
    expect(commentRows).toHaveLength(1);
    const activityRows = await testDb.select().from(activity).where(eq(activity.issueId, issueRow.id));
    expect(activityRows).toHaveLength(1);
    expect(activityRows[0]?.type).toBe("comment");
  });
});

describe("createComment — body validation (FR-040, FR-041)", () => {
  it("refuses a whitespace-only body and writes neither row", async () => {
    const { project: projectRow, member } = await fixtureWithMember();

    const result = await createComment({
      target: { projectId: projectRow.id },
      actor: actorFor(member),
      body: "   \n\t  ",
    });

    expect(result).toMatchObject({ status: "invalid", field: "body", reason: "required" });
    const commentRows = await testDb.select().from(comment).where(eq(comment.projectId, projectRow.id));
    expect(commentRows).toHaveLength(0);
    const activityRows = await testDb.select().from(activity).where(eq(activity.projectId, projectRow.id));
    expect(activityRows).toHaveLength(0);
  });

  it("refuses a 10001-character body and writes neither row", async () => {
    const { project: projectRow, member } = await fixtureWithMember();

    const result = await createComment({
      target: { projectId: projectRow.id },
      actor: actorFor(member),
      body: "a".repeat(10001),
    });

    expect(result).toMatchObject({ status: "invalid", field: "body", reason: "too-long" });
    const commentRows = await testDb.select().from(comment).where(eq(comment.projectId, projectRow.id));
    expect(commentRows).toHaveLength(0);
  });

  it("accepts a body of exactly 10000 characters", async () => {
    const { project: projectRow, member } = await fixtureWithMember();

    const result = await createComment({
      target: { projectId: projectRow.id },
      actor: actorFor(member),
      body: "a".repeat(10000),
    });

    expect(result.status).toBe("ok");
  });
});

describe("createComment — membership, derived from the target rather than a client-supplied project id (FR-015, FR-046, OT-AUTHZ-004, US1 s6, s7)", () => {
  it("derives isMember from the project itself for a { projectId } target", async () => {
    const projectRow = await insertProject();
    const outsider = await insertUser();

    const result = await createComment({
      target: { projectId: projectRow.id },
      actor: actorFor(outsider),
      body: "Hello",
    });

    expect(result).toMatchObject({ status: "forbidden" });
    const commentRows = await testDb.select().from(comment).where(eq(comment.projectId, projectRow.id));
    expect(commentRows).toHaveLength(0);
  });

  it("derives isMember from the stored issue's own project_id for an { issueId } target", async () => {
    const { project: projectRow, member } = await fixtureWithMember();
    const column = await insertColumn(projectRow.id);
    const issueRow = await insertIssue(projectRow.id, column.id, member.id);

    const otherProject = await insertProject();
    const memberOfOtherProject = await insertUser();
    await addMember(otherProject.id, memberOfOtherProject.id);

    const result = await createComment({
      target: { issueId: issueRow.id },
      actor: actorFor(memberOfOtherProject),
      body: "Hello",
    });

    expect(result).toMatchObject({ status: "forbidden" });
    const commentRows = await testDb.select().from(comment).where(eq(comment.issueId, issueRow.id));
    expect(commentRows).toHaveLength(0);
  });

  it("succeeds for a member of the issue's own project", async () => {
    const { project: projectRow, member } = await fixtureWithMember();
    const column = await insertColumn(projectRow.id);
    const issueRow = await insertIssue(projectRow.id, column.id, member.id);

    const result = await createComment({
      target: { issueId: issueRow.id },
      actor: actorFor(member),
      body: "Hello",
    });

    expect(result.status).toBe("ok");
  });

  it("refuses a non-member independently of which target shape was sent", async () => {
    const { project: projectRow, member } = await fixtureWithMember();
    const column = await insertColumn(projectRow.id);
    const issueRow = await insertIssue(projectRow.id, column.id, member.id);
    const outsider = await insertUser();

    const onProject = await createComment({
      target: { projectId: projectRow.id },
      actor: actorFor(outsider),
      body: "Hello",
    });
    const onIssue = await createComment({
      target: { issueId: issueRow.id },
      actor: actorFor(outsider),
      body: "Hello",
    });

    expect(onProject).toMatchObject({ status: "forbidden" });
    expect(onIssue).toMatchObject({ status: "forbidden" });
  });
});