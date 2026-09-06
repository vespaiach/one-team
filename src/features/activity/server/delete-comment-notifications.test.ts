import { beforeEach, describe, expect, it } from "vitest";
import { boardColumn, comment, issue, notification, project, user } from "@/db/schema";
import { testDb, testSql, truncateTestDatabase } from "@/db/test-database";
import type { Actor } from "@/features/auth/server/actor";
import { deleteComment } from "./delete-comment";

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
  const author = await insertUser({ firstName: "Ada", lastName: "Lovelace" });
  const mentioned = await insertUser({ firstName: "Grace", lastName: "Hopper" });
  const listener = await insertUser({ firstName: "Alan", lastName: "Turing" });
  const outsider = await insertUser({ firstName: "Edsger", lastName: "Dijkstra" });
  const { proj, column } = await insertProjectWithColumn();
  const issueRow = await insertIssue(proj.id, column.id, listener.id);

  const doomed = await insertComment({ authorId: author.id, issueId: issueRow.id });
  const survivingComment = await insertComment({ authorId: author.id, issueId: issueRow.id });
  const projectComment = await insertComment({ authorId: author.id, projectId: proj.id });

  const doomedMention = await insertNotification({
    userId: mentioned.id,
    actorId: author.id,
    type: "mention",
    issueId: issueRow.id,
    commentId: doomed.id,
  });
  const doomedComment = await insertNotification({
    userId: listener.id,
    actorId: author.id,
    type: "comment",
    issueId: issueRow.id,
    commentId: doomed.id,
  });
  await insertNotification({
    userId: mentioned.id,
    actorId: author.id,
    type: "assignment",
    issueId: issueRow.id,
  });
  await insertNotification({
    userId: mentioned.id,
    actorId: author.id,
    type: "mention",
    issueId: issueRow.id,
    commentId: survivingComment.id,
  });
  await insertNotification({
    userId: listener.id,
    actorId: author.id,
    type: "comment",
    projectId: proj.id,
    commentId: projectComment.id,
  });

  return { author, outsider, doomed, doomedRowIds: [doomedMention.id, doomedComment.id].sort() };
}

describe("deleteComment takes its notifications with it (FR-058, FR-061, SC-015)", () => {
  it("removes exactly the mention and comment rows carrying the deleted comment", async () => {
    const seeded = await seed();
    const before = await census();

    const result = await deleteComment({ commentId: seeded.doomed.id, actor: actorFor(seeded.author) });

    expect(result).toEqual({ status: "ok" });
    const removed = before.filter((row) => row.commentId === seeded.doomed.id);
    expect(removed.map((row) => row.id).sort()).toEqual(seeded.doomedRowIds);
    expect(await census()).toEqual(before.filter((row) => row.commentId !== seeded.doomed.id));
  });

  it("removes them inside the delete's own statement, so rolling that statement back restores both", async () => {
    const seeded = await seed();
    const before = await census();

    const connection = await testSql.reserve();
    await connection`begin`;
    await connection`delete from comment where id = ${seeded.doomed.id}`;
    const duringStatement =
      await connection`select id from notification where comment_id = ${seeded.doomed.id}`;
    await connection`rollback`;
    connection.release();

    expect(duringStatement).toHaveLength(0);
    expect(await census()).toEqual(before);
  });

  it("removes nothing when the delete is refused", async () => {
    const seeded = await seed();
    const before = await census();

    const result = await deleteComment({ commentId: seeded.doomed.id, actor: actorFor(seeded.outsider) });

    expect(result).toMatchObject({ status: "forbidden" });
    expect(await census()).toEqual(before);
  });
});