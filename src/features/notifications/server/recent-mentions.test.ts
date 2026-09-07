import { beforeEach, describe, expect, it } from "vitest";
import { boardColumn, comment, issue, notification, project, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { countUnreadNotifications, listNotifications, listRecentMentions } from "./notification-queries";

const MENTIONS_LIMIT = 5;

const TIE_LOW_ID = "00000000-0000-7000-8000-000000000001";
const TIE_HIGH_ID = "00000000-0000-7000-8000-000000000002";

const NOW = new Date("2026-06-15T12:00:00.000Z");

function ago(seconds: number): Date {
  return new Date(NOW.getTime() - seconds * 1000);
}

async function insertUser(firstName: string, lastName: string) {
  const [row] = await testDb
    .insert(user)
    .values({
      firstName,
      lastName,
      email: `${firstName.toLowerCase()}-${crypto.randomUUID()}@example.com`,
      createdAt: NOW,
      updatedAt: NOW,
    })
    .returning();
  if (!row) {
    throw new Error("insertUser produced no row");
  }
  return row;
}

async function insertProject() {
  const [row] = await testDb
    .insert(project)
    .values({
      key: `P${crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      name: "Website Redesign",
      createdAt: NOW,
      updatedAt: NOW,
    })
    .returning();
  if (!row) {
    throw new Error("insertProject produced no row");
  }
  return row;
}

async function insertIssue(projectId: string, createdBy: string) {
  const [columnRow] = await testDb
    .insert(boardColumn)
    .values({
      projectId,
      name: "Backlog",
      kind: "open",
      sortOrder: "a0",
      createdAt: NOW,
      updatedAt: NOW,
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
      createdAt: NOW,
      updatedAt: NOW,
    })
    .returning();
  if (!row) {
    throw new Error("insertIssue produced no row");
  }
  return row;
}

async function insertComment(authorId: string, issueId: string) {
  const [row] = await testDb
    .insert(comment)
    .values({ authorId, issueId, body: "Have a look", createdAt: NOW, updatedAt: NOW })
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
    createdAt: Date;
  },
) {
  const [row] = await testDb
    .insert(notification)
    .values({ updatedAt: NOW, ...values })
    .returning();
  if (!row) {
    throw new Error("insertNotification produced no row");
  }
  return row;
}

async function seed() {
  const recipient = await insertUser("Ada", "Lovelace");
  const otherRecipient = await insertUser("Grace", "Hopper");
  const actor = await insertUser("Alan", "Turing");
  const projectRow = await insertProject();
  const issueRow = await insertIssue(projectRow.id, actor.id);

  async function insertMention(
    userId: string,
    createdAt: Date,
    extra: Partial<typeof notification.$inferInsert> = {},
  ) {
    const commentRow = await insertComment(actor.id, issueRow.id);
    const row = await insertNotification({
      userId,
      actorId: actor.id,
      issueId: issueRow.id,
      commentId: commentRow.id,
      type: "mention",
      createdAt,
      ...extra,
    });
    return { row, commentRow };
  }

  const oldestMention = await insertMention(recipient.id, ago(1000));
  const secondOldestMention = await insertMention(recipient.id, ago(900));
  const readMention = await insertMention(recipient.id, ago(800), { readAt: ago(10) });
  const plainMention = await insertMention(recipient.id, ago(700));
  const commentAnchoredMention = await insertMention(recipient.id, ago(600));
  const tieLowMention = await insertMention(recipient.id, ago(500), { id: TIE_LOW_ID });
  const tieHighMention = await insertMention(recipient.id, ago(500), { id: TIE_HIGH_ID });

  const assignmentNotification = await insertNotification({
    userId: recipient.id,
    actorId: actor.id,
    issueId: issueRow.id,
    type: "assignment",
    createdAt: ago(200),
  });
  const commentTypeComment = await insertComment(actor.id, issueRow.id);
  const commentNotification = await insertNotification({
    userId: recipient.id,
    actorId: actor.id,
    issueId: issueRow.id,
    commentId: commentTypeComment.id,
    type: "comment",
    createdAt: ago(100),
  });

  const otherMentionNewest = await insertMention(otherRecipient.id, ago(50));
  const otherMentionSecond = await insertMention(otherRecipient.id, ago(40));

  return {
    recipient,
    otherRecipient,
    projectRow,
    issueRow,
    oldestMention: oldestMention.row,
    secondOldestMention: secondOldestMention.row,
    readMention: readMention.row,
    plainMention: plainMention.row,
    commentAnchoredMention: commentAnchoredMention.row,
    commentAnchoredComment: commentAnchoredMention.commentRow,
    tieLowMention: tieLowMention.row,
    tieHighMention: tieHighMention.row,
    assignmentNotification,
    commentNotification,
    otherMentionNewest: otherMentionNewest.row,
    otherMentionSecond: otherMentionSecond.row,
  };
}

beforeEach(async () => {
  await truncateTestDatabase();
});

describe("listRecentMentions (FR-021…FR-027, SC-007)", () => {
  it("returns only the caller's own mentions and never a second user's", async () => {
    const fixture = await seed();

    const rows = await listRecentMentions(fixture.recipient.id, MENTIONS_LIMIT);

    const ids = rows.map((row) => row.id);
    expect(ids).not.toContain(fixture.otherMentionNewest.id);
    expect(ids).not.toContain(fixture.otherMentionSecond.id);
  });

  it("counts unread notifications for the caller alone", async () => {
    const fixture = await seed();

    const unread = await countUnreadNotifications(fixture.recipient.id);

    expect(unread).toBe(8);
    expect(await countUnreadNotifications(fixture.otherRecipient.id)).toBe(2);
  });

  it("returns at most five rows, newest first", async () => {
    const fixture = await seed();

    const rows = await listRecentMentions(fixture.recipient.id, MENTIONS_LIMIT);

    expect(rows.map((row) => row.id)).toEqual([
      fixture.tieHighMention.id,
      fixture.tieLowMention.id,
      fixture.commentAnchoredMention.id,
      fixture.plainMention.id,
      fixture.readMention.id,
    ]);
    expect(rows).toHaveLength(MENTIONS_LIMIT);
  });

  it("resolves a seeded tie identically across two reads", async () => {
    const fixture = await seed();

    const first = await listRecentMentions(fixture.recipient.id, MENTIONS_LIMIT);
    const second = await listRecentMentions(fixture.recipient.id, MENTIONS_LIMIT);

    expect(first.map((row) => row.id)).toEqual(second.map((row) => row.id));
    expect(first.slice(0, 2).map((row) => row.id)).toEqual([
      fixture.tieHighMention.id,
      fixture.tieLowMention.id,
    ]);
  });

  it("excludes assignment and comment notifications", async () => {
    const fixture = await seed();

    const rows = await listRecentMentions(fixture.recipient.id, MENTIONS_LIMIT);

    expect(rows.every((row) => row.type === "mention")).toBe(true);
    const ids = rows.map((row) => row.id);
    expect(ids).not.toContain(fixture.assignmentNotification.id);
    expect(ids).not.toContain(fixture.commentNotification.id);
  });

  it("lists read and unread mentions together", async () => {
    const fixture = await seed();

    const rows = await listRecentMentions(fixture.recipient.id, MENTIONS_LIMIT);

    expect(rows.some((row) => row.isUnread)).toBe(true);
    expect(rows.find((row) => row.id === fixture.readMention.id)?.isUnread).toBe(false);
  });

  it("carries the comment anchor on a mention that names a comment", async () => {
    const fixture = await seed();

    const rows = await listRecentMentions(fixture.recipient.id, MENTIONS_LIMIT);

    const anchored = rows.find((row) => row.id === fixture.commentAnchoredMention.id);
    expect(anchored?.href).toBe(
      `/projects/${fixture.projectRow.key}/issues/${fixture.issueRow.number}/details#comment-${fixture.commentAnchoredComment.id}`,
    );
    expect(anchored?.actorName).toBe("Alan Turing");
    expect(anchored?.targetLabel).toBe(
      `${fixture.projectRow.key}-${fixture.issueRow.number} · ${fixture.issueRow.title}`,
    );
  });
});

describe("R11's existing exports are unchanged (FR-044)", () => {
  it("listNotifications still returns every one of the caller's notifications, newest first", async () => {
    const fixture = await seed();

    const rows = await listNotifications(fixture.recipient.id);

    expect(rows.map((row) => row.id)).toEqual([
      fixture.commentNotification.id,
      fixture.assignmentNotification.id,
      fixture.tieHighMention.id,
      fixture.tieLowMention.id,
      fixture.commentAnchoredMention.id,
      fixture.plainMention.id,
      fixture.readMention.id,
      fixture.secondOldestMention.id,
      fixture.oldestMention.id,
    ]);
  });
});