import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { boardColumn, comment, issue, notification, project, user } from "./schema";
import { testDb, truncateTestDatabase } from "./test-database";

beforeEach(async () => {
  await truncateTestDatabase();
});

async function insertUser(firstName: string, lastName: string) {
  const now = new Date();
  const [row] = await testDb
    .insert(user)
    .values({
      firstName,
      lastName,
      email: `${lastName.toLowerCase()}-${crypto.randomUUID()}@example.com`,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!row) {
    throw new Error("insertUser produced no row");
  }
  return row;
}

async function insertProject(name: string) {
  const now = new Date();
  const [row] = await testDb
    .insert(project)
    .values({
      key: `P${crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      name,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!row) {
    throw new Error("insertProject produced no row");
  }
  return row;
}

async function insertIssue(projectId: string, createdBy: string) {
  const now = new Date();
  const [columnRow] = await testDb
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
  if (!columnRow) {
    throw new Error("insertIssue produced no column");
  }
  const [row] = await testDb
    .insert(issue)
    .values({
      projectId,
      number: 1,
      title: "Fix the header",
      columnId: columnRow.id,
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

async function insertComment(authorId: string, target: { issueId: string } | { projectId: string }) {
  const now = new Date();
  const [row] = await testDb
    .insert(comment)
    .values({ authorId, body: "Looks good.", createdAt: now, updatedAt: now, ...target })
    .returning();
  if (!row) {
    throw new Error("insertComment produced no row");
  }
  return row;
}

async function insertNotification(
  values: Pick<typeof notification.$inferInsert, "userId" | "actorId" | "type"> &
    Partial<typeof notification.$inferInsert>,
) {
  const now = new Date();
  const [row] = await testDb
    .insert(notification)
    .values({ createdAt: now, updatedAt: now, ...values })
    .returning();
  if (!row) {
    throw new Error("insertNotification produced no row");
  }
  return row;
}

async function notificationIds(): Promise<string[]> {
  const rows = await testDb.select({ id: notification.id }).from(notification);
  return rows.map((row) => row.id).sort();
}

async function seed() {
  const actor = await insertUser("Ada", "Lovelace");
  const recipient = await insertUser("Grace", "Hopper");

  const doomed = await insertProject("Website Redesign");
  const doomedIssue = await insertIssue(doomed.id, actor.id);
  const issueComment = await insertComment(actor.id, { issueId: doomedIssue.id });
  const projectComment = await insertComment(actor.id, { projectId: doomed.id });

  const bystander = await insertProject("Mobile App");
  const bystanderIssue = await insertIssue(bystander.id, actor.id);
  const bystanderComment = await insertComment(actor.id, { issueId: bystanderIssue.id });

  const base = { userId: recipient.id, actorId: actor.id };
  const onIssue = await insertNotification({ ...base, type: "assignment", issueId: doomedIssue.id });
  const onIssueComment = await insertNotification({
    ...base,
    type: "mention",
    issueId: doomedIssue.id,
    commentId: issueComment.id,
  });
  const onProject = await insertNotification({ ...base, type: "assignment", projectId: doomed.id });
  const onProjectComment = await insertNotification({
    ...base,
    type: "comment",
    projectId: doomed.id,
    commentId: projectComment.id,
  });
  const onBystanderIssue = await insertNotification({
    ...base,
    type: "assignment",
    issueId: bystanderIssue.id,
  });
  const onBystanderComment = await insertNotification({
    ...base,
    type: "mention",
    issueId: bystanderIssue.id,
    commentId: bystanderComment.id,
  });

  return {
    doomed,
    doomedIssue,
    issueComment,
    onIssue,
    onIssueComment,
    onProject,
    onProjectComment,
    bystanders: [onBystanderIssue.id, onBystanderComment.id].sort(),
  };
}

describe("deleting a comment removes exactly its notifications (FR-058, research C-1)", () => {
  it("removes the row carrying that comment_id and nothing else", async () => {
    const seeded = await seed();

    await testDb.delete(comment).where(eq(comment.id, seeded.issueComment.id));

    expect(await notificationIds()).toEqual(
      [seeded.onIssue.id, seeded.onProject.id, seeded.onProjectComment.id, ...seeded.bystanders].sort(),
    );
  });
});

describe("deleting an issue removes its notifications transitively (FR-059, research C-1)", () => {
  it("removes the rows on the issue and on its comments, and nothing else", async () => {
    const seeded = await seed();

    await testDb.delete(issue).where(eq(issue.id, seeded.doomedIssue.id));

    expect(await notificationIds()).toEqual(
      [seeded.onProject.id, seeded.onProjectComment.id, ...seeded.bystanders].sort(),
    );
  });
});

describe("deleting a project removes its notifications transitively (FR-060, research C-1)", () => {
  it("removes the rows on the project, its issues and every comment beneath it", async () => {
    const seeded = await seed();

    await testDb.delete(project).where(eq(project.id, seeded.doomed.id));

    expect(await notificationIds()).toEqual([...seeded.bystanders]);
  });
});

describe("no cascade path reaches a user row (FR-062, research A-5)", () => {
  it("leaves both people in place after the comment, issue and project deletes", async () => {
    const seeded = await seed();
    const before = await testDb.select({ id: user.id }).from(user);

    await testDb.delete(comment).where(eq(comment.id, seeded.issueComment.id));
    await testDb.delete(issue).where(eq(issue.id, seeded.doomedIssue.id));
    await testDb.delete(project).where(eq(project.id, seeded.doomed.id));

    const after = await testDb.select({ id: user.id }).from(user);
    expect(after.map((row) => row.id).sort()).toEqual(before.map((row) => row.id).sort());
  });
});