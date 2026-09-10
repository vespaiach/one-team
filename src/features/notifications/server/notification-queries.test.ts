import { uuidv7 } from "uuidv7";
import { beforeEach, describe, expect, it } from "vitest";
import { boardColumn, comment, issue, notification, project, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { countUnreadNotifications, listNotifications } from "./notification-queries";

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

async function insertIssue(
  projectId: string,
  createdBy: string,
  overrides: Partial<typeof issue.$inferInsert> = {},
) {
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
      number: 142,
      title: "Fix the header",
      columnId: columnRow.id,
      createdBy,
      sortOrder: "a0",
      createdAt: now,
      updatedAt: now,
      ...overrides,
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
    .values({ authorId, body: "Have a look", createdAt: now, updatedAt: now, ...target })
    .returning();
  if (!row) {
    throw new Error("insertComment produced no row");
  }
  return row;
}

async function insertNotification(
  values: Partial<typeof notification.$inferInsert> & {
    userId: string;
    actorId: string;
    type: string;
  },
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

describe("listNotifications (FR-011, FR-024, SC-001)", () => {
  it("returns the caller's own rows and never another user's", async () => {
    const recipient = await insertUser({ firstName: "Ada", lastName: "Lovelace" });
    const other = await insertUser({ firstName: "Grace", lastName: "Hopper" });
    const actor = await insertUser({ firstName: "Alan", lastName: "Turing" });
    const projectRow = await insertProject();
    const issueRow = await insertIssue(projectRow.id, actor.id);

    const mine = await insertNotification({
      userId: recipient.id,
      actorId: actor.id,
      type: "assignment",
      issueId: issueRow.id,
    });
    await insertNotification({
      userId: other.id,
      actorId: actor.id,
      type: "assignment",
      issueId: issueRow.id,
    });

    const rows = await listNotifications(recipient.id);

    expect(rows.map((row) => row.id)).toEqual([mine.id]);
  });

  it("orders by created_at descending, tie-broken by id descending", async () => {
    const recipient = await insertUser();
    const actor = await insertUser({ firstName: "Alan", lastName: "Turing" });
    const projectRow = await insertProject();
    const issueRow = await insertIssue(projectRow.id, actor.id);

    const shared = new Date("2026-03-01T10:00:00.000Z");
    const older = new Date("2026-03-01T09:00:00.000Z");
    const firstId = uuidv7();
    const secondId = uuidv7();

    await insertNotification({
      id: firstId,
      userId: recipient.id,
      actorId: actor.id,
      type: "assignment",
      issueId: issueRow.id,
      createdAt: shared,
      updatedAt: shared,
    });
    await insertNotification({
      id: secondId,
      userId: recipient.id,
      actorId: actor.id,
      type: "assignment",
      issueId: issueRow.id,
      createdAt: shared,
      updatedAt: shared,
    });
    const oldest = await insertNotification({
      userId: recipient.id,
      actorId: actor.id,
      type: "assignment",
      issueId: issueRow.id,
      createdAt: older,
      updatedAt: older,
    });

    const rows = await listNotifications(recipient.id);

    expect(rows.map((row) => row.id)).toEqual([secondId, firstId, oldest.id]);
  });

  it("returns at most the 200 most recent rows, with no offset and nothing deleted (FR-022)", async () => {
    const recipient = await insertUser();
    const actor = await insertUser({ firstName: "Alan", lastName: "Turing" });
    const projectRow = await insertProject();
    const issueRow = await insertIssue(projectRow.id, actor.id);

    const base = Date.parse("2026-03-01T10:00:00.000Z");
    const values = Array.from({ length: 205 }, (_, index) => {
      const createdAt = new Date(base + index * 1000);
      return {
        userId: recipient.id,
        actorId: actor.id,
        type: "assignment",
        issueId: issueRow.id,
        createdAt,
        updatedAt: createdAt,
      };
    });
    await testDb.insert(notification).values(values);

    const rows = await listNotifications(recipient.id);

    expect(rows).toHaveLength(200);
    expect(rows[0]?.createdAt.toISOString()).toBe(new Date(base + 204 * 1000).toISOString());
    const stored = await testDb.select({ id: notification.id }).from(notification);
    expect(stored).toHaveLength(205);
  });
});

describe("listNotifications composes href and targetLabel server-side (FR-014, FR-015, data-model §4)", () => {
  it("links an issue row with no comment to the issue's detail page", async () => {
    const recipient = await insertUser();
    const actor = await insertUser({ firstName: "Alan", lastName: "Turing" });
    const projectRow = await insertProject({ key: "WEB", name: "Website Redesign" });
    const issueRow = await insertIssue(projectRow.id, actor.id, { number: 142, title: "Fix the header" });

    await insertNotification({
      userId: recipient.id,
      actorId: actor.id,
      type: "assignment",
      issueId: issueRow.id,
    });

    const [row] = await listNotifications(recipient.id);

    expect(row?.href).toBe("/projects/WEB/issues/142/details");
    expect(row?.targetLabel).toBe("WEB-142 · Fix the header");
  });

  it("lands an issue row carrying a comment on that comment's anchor", async () => {
    const recipient = await insertUser();
    const actor = await insertUser({ firstName: "Alan", lastName: "Turing" });
    const projectRow = await insertProject({ key: "WEB", name: "Website Redesign" });
    const issueRow = await insertIssue(projectRow.id, actor.id, { number: 142, title: "Fix the header" });
    const commentRow = await insertComment(actor.id, { issueId: issueRow.id });

    await insertNotification({
      userId: recipient.id,
      actorId: actor.id,
      type: "mention",
      issueId: issueRow.id,
      commentId: commentRow.id,
    });

    const [row] = await listNotifications(recipient.id);

    expect(row?.href).toBe(`/projects/WEB/issues/142/details#comment-${commentRow.id}`);
  });

  it("links a project row with no comment to the project's details page", async () => {
    const recipient = await insertUser();
    const actor = await insertUser({ firstName: "Alan", lastName: "Turing" });
    const projectRow = await insertProject({ key: "WEB", name: "Website Redesign" });

    await insertNotification({
      userId: recipient.id,
      actorId: actor.id,
      type: "assignment",
      projectId: projectRow.id,
    });

    const [row] = await listNotifications(recipient.id);

    expect(row?.href).toBe("/projects/WEB/details");
    expect(row?.targetLabel).toBe("Website Redesign");
  });

  it("lands a project row carrying a comment on that comment's anchor", async () => {
    const recipient = await insertUser();
    const actor = await insertUser({ firstName: "Alan", lastName: "Turing" });
    const projectRow = await insertProject({ key: "WEB", name: "Website Redesign" });
    const commentRow = await insertComment(actor.id, { projectId: projectRow.id });

    await insertNotification({
      userId: recipient.id,
      actorId: actor.id,
      type: "comment",
      projectId: projectRow.id,
      commentId: commentRow.id,
    });

    const [row] = await listNotifications(recipient.id);

    expect(row?.href).toBe(`/projects/WEB/details#comment-${commentRow.id}`);
    expect(row?.targetLabel).toBe("Website Redesign");
  });
});

describe("listNotifications maps the row to the screen's DTO (FR-012, FR-073, E-2)", () => {
  it("reports isUnread from read_at being null", async () => {
    const recipient = await insertUser();
    const actor = await insertUser({ firstName: "Alan", lastName: "Turing" });
    const projectRow = await insertProject();
    const issueRow = await insertIssue(projectRow.id, actor.id);

    const readAt = new Date("2026-03-01T12:00:00.000Z");
    const unread = await insertNotification({
      userId: recipient.id,
      actorId: actor.id,
      type: "assignment",
      issueId: issueRow.id,
      createdAt: new Date("2026-03-01T11:00:00.000Z"),
      updatedAt: new Date("2026-03-01T11:00:00.000Z"),
    });
    const read = await insertNotification({
      userId: recipient.id,
      actorId: actor.id,
      type: "assignment",
      issueId: issueRow.id,
      readAt,
      createdAt: new Date("2026-03-01T10:00:00.000Z"),
      updatedAt: new Date("2026-03-01T10:00:00.000Z"),
    });

    const rows = await listNotifications(recipient.id);

    expect(rows.find((row) => row.id === unread.id)?.isUnread).toBe(true);
    expect(rows.find((row) => row.id === read.id)?.isUnread).toBe(false);
  });

  it("renders the actor's display name even when the actor has since been deactivated", async () => {
    const recipient = await insertUser();
    const actor = await insertUser({
      firstName: "Alan",
      lastName: "Turing",
      deactivatedAt: new Date("2026-02-01T00:00:00.000Z"),
    });
    const projectRow = await insertProject();
    const issueRow = await insertIssue(projectRow.id, actor.id);

    await insertNotification({
      userId: recipient.id,
      actorId: actor.id,
      type: "assignment",
      issueId: issueRow.id,
    });

    const [row] = await listNotifications(recipient.id);

    expect(row?.actorName).toBe("Alan Turing");
  });

  it("carries the actor's avatar URL, or null when they have none", async () => {
    const recipient = await insertUser();
    const actor = await insertUser({ avatarUrl: "https://example.com/gh.png" });
    const projectRow = await insertProject();
    const issueRow = await insertIssue(projectRow.id, actor.id);

    await insertNotification({
      userId: recipient.id,
      actorId: actor.id,
      type: "assignment",
      issueId: issueRow.id,
    });

    const [row] = await listNotifications(recipient.id);

    expect(row?.actorAvatarUrl).toBe("https://example.com/gh.png");
  });

  it("carries exactly the seven DTO keys, with no send_attempts, emailed_at, read_at or email", async () => {
    const recipient = await insertUser();
    const actor = await insertUser({ firstName: "Alan", lastName: "Turing" });
    const projectRow = await insertProject();
    const issueRow = await insertIssue(projectRow.id, actor.id);

    await insertNotification({
      userId: recipient.id,
      actorId: actor.id,
      type: "assignment",
      issueId: issueRow.id,
    });

    const [row] = await listNotifications(recipient.id);

    expect(row).toBeDefined();
    expect(Object.keys(row ?? {}).sort()).toEqual([
      "actorAvatarUrl",
      "actorName",
      "createdAt",
      "href",
      "id",
      "isUnread",
      "targetLabel",
      "type",
    ]);
  });

  it("carries the stored type for each of the three kinds", async () => {
    const recipient = await insertUser();
    const actor = await insertUser({ firstName: "Alan", lastName: "Turing" });
    const projectRow = await insertProject();
    const issueRow = await insertIssue(projectRow.id, actor.id);
    const commentRow = await insertComment(actor.id, { issueId: issueRow.id });
    const otherComment = await insertComment(actor.id, { issueId: issueRow.id });

    await insertNotification({
      userId: recipient.id,
      actorId: actor.id,
      type: "mention",
      issueId: issueRow.id,
      commentId: commentRow.id,
      createdAt: new Date("2026-03-01T12:00:00.000Z"),
      updatedAt: new Date("2026-03-01T12:00:00.000Z"),
    });
    await insertNotification({
      userId: recipient.id,
      actorId: actor.id,
      type: "comment",
      issueId: issueRow.id,
      commentId: otherComment.id,
      createdAt: new Date("2026-03-01T11:00:00.000Z"),
      updatedAt: new Date("2026-03-01T11:00:00.000Z"),
    });
    await insertNotification({
      userId: recipient.id,
      actorId: actor.id,
      type: "assignment",
      issueId: issueRow.id,
      createdAt: new Date("2026-03-01T10:00:00.000Z"),
      updatedAt: new Date("2026-03-01T10:00:00.000Z"),
    });

    const rows = await listNotifications(recipient.id);

    expect(rows.map((row) => row.type)).toEqual(["mention", "comment", "assignment"]);
  });
});
describe("countUnreadNotifications (FR-033, FR-035, SC-012)", () => {
  it("counts only the caller's own unread rows", async () => {
    const recipient = await insertUser();
    const other = await insertUser({ firstName: "Grace", lastName: "Hopper" });
    const actor = await insertUser({ firstName: "Alan", lastName: "Turing" });
    const projectRow = await insertProject();
    const issueRow = await insertIssue(projectRow.id, actor.id);

    await insertNotification({
      userId: recipient.id,
      actorId: actor.id,
      type: "assignment",
      issueId: issueRow.id,
    });
    await insertNotification({
      userId: recipient.id,
      actorId: actor.id,
      type: "assignment",
      issueId: issueRow.id,
      readAt: new Date("2026-03-01T10:00:00.000Z"),
    });
    await insertNotification({
      userId: other.id,
      actorId: actor.id,
      type: "assignment",
      issueId: issueRow.id,
    });

    expect(await countUnreadNotifications(recipient.id)).toBe(1);
  });

  it("counts every unread row, unbounded by the list's 200-row cap", async () => {
    const recipient = await insertUser();
    const actor = await insertUser({ firstName: "Alan", lastName: "Turing" });
    const projectRow = await insertProject();
    const issueRow = await insertIssue(projectRow.id, actor.id);
    const base = new Date("2026-03-01T10:00:00.000Z");

    await testDb.insert(notification).values(
      Array.from({ length: 205 }, (_, index) => ({
        userId: recipient.id,
        actorId: actor.id,
        type: "assignment",
        issueId: issueRow.id,
        createdAt: new Date(base.getTime() + index * 1000),
        updatedAt: new Date(base.getTime() + index * 1000),
      })),
    );

    expect(await countUnreadNotifications(recipient.id)).toBe(205);
    expect(await listNotifications(recipient.id)).toHaveLength(200);
  });

  it("reads zero when the caller holds nothing", async () => {
    const recipient = await insertUser();

    expect(await countUnreadNotifications(recipient.id)).toBe(0);
  });
});