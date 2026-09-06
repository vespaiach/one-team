import { beforeEach, describe, expect, it } from "vitest";
import { boardColumn, comment, issue, notification, project, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { deleteProject } from "./delete-project";
import { setProjectStatus } from "./project-status";

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

async function insertProjectWithColumn(name: string) {
  const now = new Date();
  const [proj] = await testDb
    .insert(project)
    .values({
      key: `P${crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      name,
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

async function seedProject(name: string, actorId: string, recipientId: string) {
  const { proj, column } = await insertProjectWithColumn(name);
  const issueRow = await insertIssue(proj.id, column.id, actorId);
  const issueComment = await insertComment({ authorId: actorId, issueId: issueRow.id });
  const projectComment = await insertComment({ authorId: actorId, projectId: proj.id });

  const onIssue = await insertNotification({
    userId: recipientId,
    actorId,
    type: "assignment",
    issueId: issueRow.id,
  });
  const onIssueComment = await insertNotification({
    userId: recipientId,
    actorId,
    type: "mention",
    issueId: issueRow.id,
    commentId: issueComment.id,
  });
  const onProjectComment = await insertNotification({
    userId: recipientId,
    actorId,
    type: "comment",
    projectId: proj.id,
    commentId: projectComment.id,
  });

  return { proj, rowIds: [onIssue.id, onIssueComment.id, onProjectComment.id].sort() };
}

async function seed() {
  const admin = await insertUser({ firstName: "Grace", lastName: "Hopper", role: "admin" });
  const recipient = await insertUser({ firstName: "Alan", lastName: "Turing" });
  const doomed = await seedProject("Website Redesign", admin.id, recipient.id);
  const bystander = await seedProject("Mobile App", admin.id, recipient.id);
  return { admin, doomed, bystander };
}

describe("deleteProject takes every notification beneath it (FR-060, FR-061, SC-015)", () => {
  it("removes the rows on the project, its issues and their comments once it is archived", async () => {
    const seeded = await seed();
    const before = await census();
    await setProjectStatus(seeded.doomed.proj.id, "archived", seeded.admin.id);

    const result = await deleteProject(seeded.doomed.proj.id);

    expect(result).toEqual({ status: "deleted" });
    const removed = before.filter((row) => seeded.doomed.rowIds.includes(row.id));
    expect(removed).toHaveLength(3);
    expect(await census()).toEqual(before.filter((row) => !seeded.doomed.rowIds.includes(row.id)));
  });

  it("touches no other project's rows", async () => {
    const seeded = await seed();
    const before = await census();
    const bystanderRows = before.filter((row) => seeded.bystander.rowIds.includes(row.id));
    await setProjectStatus(seeded.doomed.proj.id, "archived", seeded.admin.id);

    await deleteProject(seeded.doomed.proj.id);

    expect(bystanderRows).toHaveLength(3);
    expect(await census()).toEqual(bystanderRows);
  });

  it("removes nothing when the project is not archived", async () => {
    const seeded = await seed();
    const before = await census();

    const result = await deleteProject(seeded.doomed.proj.id);

    expect(result).toEqual({ status: "not_archived" });
    expect(await census()).toEqual(before);
  });
});