import { beforeEach, describe, expect, it } from "vitest";
import { boardColumn, issue, notification, project, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { markAllNotificationsRead } from "./server/mark-read";
import { countUnreadNotifications, listNotifications } from "./server/notification-queries";

const UNREAD_ROWS = 250;

beforeEach(async () => {
  await truncateTestDatabase();
});

async function insertUser(firstName: string) {
  const now = new Date();
  const [row] = await testDb
    .insert(user)
    .values({
      firstName,
      lastName: "Lovelace",
      email: `${firstName.toLowerCase()}-${crypto.randomUUID()}@example.com`,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!row) {
    throw new Error("insertUser produced no row");
  }
  return row;
}

async function insertIssueRow(createdBy: string) {
  const now = new Date();
  const [projectRow] = await testDb
    .insert(project)
    .values({
      key: `P${crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      name: "Website Redesign",
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!projectRow) {
    throw new Error("insertIssueRow produced no project");
  }
  const [columnRow] = await testDb
    .insert(boardColumn)
    .values({
      projectId: projectRow.id,
      name: "Backlog",
      kind: "open",
      sortOrder: "a0",
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!columnRow) {
    throw new Error("insertIssueRow produced no column");
  }
  const [issueRow] = await testDb
    .insert(issue)
    .values({
      projectId: projectRow.id,
      number: 142,
      title: "Fix the header",
      columnId: columnRow.id,
      createdBy,
      sortOrder: "a0",
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!issueRow) {
    throw new Error("insertIssueRow produced no issue");
  }
  return issueRow;
}

async function seedUnread(recipientId: string, actorId: string, issueId: string, howMany: number) {
  const base = new Date("2026-03-01T10:00:00.000Z");
  await testDb.insert(notification).values(
    Array.from({ length: howMany }, (_, index) => ({
      userId: recipientId,
      actorId,
      type: "assignment",
      issueId,
      createdAt: new Date(base.getTime() + index * 1000),
      updatedAt: new Date(base.getTime() + index * 1000),
    })),
  );
}

describe("the unread count is not bounded by the list cap (FR-022, FR-033, SC-012)", () => {
  it("counts every unread row while the list stops at 200", async () => {
    const recipient = await insertUser("Ada");
    const actor = await insertUser("Alan");
    const issueRow = await insertIssueRow(actor.id);
    await seedUnread(recipient.id, actor.id, issueRow.id, UNREAD_ROWS);

    expect(await countUnreadNotifications(recipient.id)).toBe(UNREAD_ROWS);
    expect(await listNotifications(recipient.id)).toHaveLength(200);
  });

  it("clears all 250 when the caller marks everything read, including the rows the screen never listed", async () => {
    const recipient = await insertUser("Ada");
    const actor = await insertUser("Alan");
    const issueRow = await insertIssueRow(actor.id);
    await seedUnread(recipient.id, actor.id, issueRow.id, UNREAD_ROWS);

    await markAllNotificationsRead(recipient.id);

    expect(await countUnreadNotifications(recipient.id)).toBe(0);
    const rows = await listNotifications(recipient.id);
    expect(rows).toHaveLength(200);
    expect(rows.every((row) => row.isUnread === false)).toBe(true);
  });

  it("leaves another user's unread rows untouched", async () => {
    const recipient = await insertUser("Ada");
    const other = await insertUser("Grace");
    const actor = await insertUser("Alan");
    const issueRow = await insertIssueRow(actor.id);
    await seedUnread(recipient.id, actor.id, issueRow.id, UNREAD_ROWS);
    await seedUnread(other.id, actor.id, issueRow.id, 4);

    await markAllNotificationsRead(recipient.id);

    expect(await countUnreadNotifications(other.id)).toBe(4);
  });
});