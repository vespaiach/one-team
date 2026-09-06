import { beforeEach, describe, expect, it } from "vitest";
import { boardColumn, comment, issue, notification, project, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import type { Actor } from "@/features/auth/server/actor";
import { deleteIssue } from "./delete-issue";

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
      email: `person-${crypto.randomUUID()}@example.com`,
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

async function insertIssue(projectId: string, columnId: string, createdBy: string, number: number) {
  const now = new Date();
  const [row] = await testDb
    .insert(issue)
    .values({
      projectId,
      number,
      title: `Issue ${number}`,
      columnId,
      createdBy,
      sortOrder: `a${number}`,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!row) {
    throw new Error("insertIssue produced no row");
  }
  return row;
}

async function insertComment(values: Partial<typeof comment.$inferInsert> & { authorId: string }) {
  const now = new Date();
  const [row] = await testDb
    .insert(comment)
    .values({ body: "Looks good.", createdAt: now, updatedAt: now, ...values })
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
  const rows = await testDb
    .select({
      id: notification.id,
      userId: notification.userId,
      actorId: notification.actorId,
      type: notification.type,
      issueId: notification.issueId,
      projectId: notification.projectId,
      commentId: notification.commentId,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
    })
    .from(notification);
  return rows.sort((left, right) => left.id.localeCompare(right.id));
}

async function seed() {
  const admin = await insertUser({ firstName: "Grace", lastName: "Hopper", role: "admin" });
  const member = await insertUser({ firstName: "Alan", lastName: "Turing" });
  const recipient = await insertUser({ firstName: "Edsger", lastName: "Dijkstra" });
  const { proj, column } = await insertProjectWithColumn();

  const doomedIssue = await insertIssue(proj.id, column.id, member.id, 1);
  const bystanderIssue = await insertIssue(proj.id, column.id, member.id, 2);
  const doomedComment = await insertComment({ authorId: member.id, issueId: doomedIssue.id });
  const bystanderComment = await insertComment({ authorId: member.id, issueId: bystanderIssue.id });
  const projectComment = await insertComment({ authorId: member.id, projectId: proj.id });

  const onIssue = await insertNotification({
    userId: recipient.id,
    actorId: member.id,
    type: "assignment",
    issueId: doomedIssue.id,
  });
  const onIssueCommentMention = await insertNotification({
    userId: recipient.id,
    actorId: member.id,
    type: "mention",
    issueId: doomedIssue.id,
    commentId: doomedComment.id,
  });
  const onIssueCommentReply = await insertNotification({
    userId: admin.id,
    actorId: member.id,
    type: "comment",
    issueId: doomedIssue.id,
    commentId: doomedComment.id,
  });
  await insertNotification({
    userId: recipient.id,
    actorId: member.id,
    type: "assignment",
    issueId: bystanderIssue.id,
  });
  await insertNotification({
    userId: recipient.id,
    actorId: member.id,
    type: "mention",
    issueId: bystanderIssue.id,
    commentId: bystanderComment.id,
  });
  await insertNotification({
    userId: admin.id,
    actorId: member.id,
    type: "comment",
    projectId: proj.id,
    commentId: projectComment.id,
  });

  return {
    admin,
    member,
    doomedIssue,
    doomedComment,
    doomedRowIds: [onIssue.id, onIssueCommentMention.id, onIssueCommentReply.id].sort(),
  };
}

describe("deleteIssue takes its notifications and its comments' notifications with it (FR-059, FR-061, SC-015)", () => {
  it("removes every row reaching the issue or any comment beneath it", async () => {
    const seeded = await seed();
    const before = await census();

    const result = await deleteIssue({ issueId: seeded.doomedIssue.id, actor: actorFor(seeded.admin) });

    expect(result).toEqual({ status: "ok" });
    const survivors = before.filter(
      (row) => row.issueId !== seeded.doomedIssue.id && row.commentId !== seeded.doomedComment.id,
    );
    expect(before.length - survivors.length).toBe(seeded.doomedRowIds.length);
    expect(await census()).toEqual(survivors);
  });

  it("takes the comment beneath it and that comment's rows in the same delete", async () => {
    const seeded = await seed();
    const before = await census();
    const onComment = before.filter((row) => row.commentId === seeded.doomedComment.id);

    await deleteIssue({ issueId: seeded.doomedIssue.id, actor: actorFor(seeded.admin) });

    expect(onComment).toHaveLength(2);
    const remainingComments = await testDb.select({ id: comment.id }).from(comment);
    expect(remainingComments.map((row) => row.id)).not.toContain(seeded.doomedComment.id);
    const remainingIds = (await census()).map((row) => row.id);
    for (const row of onComment) {
      expect(remainingIds).not.toContain(row.id);
    }
  });

  it("removes nothing when the delete is refused", async () => {
    const seeded = await seed();
    const before = await census();

    const result = await deleteIssue({ issueId: seeded.doomedIssue.id, actor: actorFor(seeded.member) });

    expect(result).toMatchObject({ status: "forbidden" });
    expect(await census()).toEqual(before);
  });
});