import { eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { beforeEach, describe, expect, it } from "vitest";
import { boardColumn, issue, notification, project, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { markAllNotificationsRead, markNotificationRead } from "./mark-read";

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
  const [row] = await testDb
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
  if (!row) {
    throw new Error("insertIssueRow produced no row");
  }
  return row;
}

async function insertNotification(
  values: Partial<typeof notification.$inferInsert> & { userId: string; actorId: string },
) {
  const now = new Date();
  const [row] = await testDb
    .insert(notification)
    .values({ type: "assignment", createdAt: now, updatedAt: now, ...values })
    .returning();
  if (!row) {
    throw new Error("insertNotification produced no row");
  }
  return row;
}

async function readRow(id: string) {
  const [row] = await testDb.select().from(notification).where(eq(notification.id, id));
  if (!row) {
    throw new Error(`no notification row ${id}`);
  }
  return row;
}

describe("markNotificationRead (FR-025, FR-026, FR-027, FR-031, SC-002)", () => {
  it("stamps read_at on the caller's own unread row", async () => {
    const recipient = await insertUser();
    const actor = await insertUser({ firstName: "Alan", lastName: "Turing" });
    const issueRow = await insertIssueRow(actor.id);
    const row = await insertNotification({
      userId: recipient.id,
      actorId: actor.id,
      issueId: issueRow.id,
    });

    const outcome = await markNotificationRead({
      userId: recipient.id,
      notificationId: row.id,
    });

    expect(outcome).toBe("ok");
    expect((await readRow(row.id)).readAt).not.toBeNull();
  });

  it("leaves an already-read row's first moment untouched and updates zero rows", async () => {
    const recipient = await insertUser();
    const actor = await insertUser({ firstName: "Alan", lastName: "Turing" });
    const issueRow = await insertIssueRow(actor.id);
    const firstMoment = new Date("2026-03-01T10:00:00.000Z");
    const row = await insertNotification({
      userId: recipient.id,
      actorId: actor.id,
      issueId: issueRow.id,
      readAt: firstMoment,
    });

    const outcome = await markNotificationRead({
      userId: recipient.id,
      notificationId: row.id,
    });

    expect(outcome).toBe("ok");
    expect((await readRow(row.id)).readAt?.toISOString()).toBe(firstMoment.toISOString());
  });

  it("leaves another user's row unchanged and reports it missing", async () => {
    const recipient = await insertUser();
    const stranger = await insertUser({ firstName: "Grace", lastName: "Hopper" });
    const actor = await insertUser({ firstName: "Alan", lastName: "Turing" });
    const issueRow = await insertIssueRow(actor.id);
    const foreign = await insertNotification({
      userId: stranger.id,
      actorId: actor.id,
      issueId: issueRow.id,
    });

    const outcome = await markNotificationRead({
      userId: recipient.id,
      notificationId: foreign.id,
    });

    expect(outcome).toBe("not-found");
    expect((await readRow(foreign.id)).readAt).toBeNull();
  });

  it("reports an id naming no row exactly as it reports a foreign row", async () => {
    const recipient = await insertUser();

    const outcome = await markNotificationRead({
      userId: recipient.id,
      notificationId: uuidv7(),
    });

    expect(outcome).toBe("not-found");
  });
});

describe("markAllNotificationsRead (FR-028, FR-029, FR-030, SC-011)", () => {
  it("clears every unread row the caller holds, including rows past the 200-row bound", async () => {
    const recipient = await insertUser();
    const actor = await insertUser({ firstName: "Alan", lastName: "Turing" });
    const issueRow = await insertIssueRow(actor.id);
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

    await markAllNotificationsRead(recipient.id);

    const rows = await testDb.select().from(notification).where(eq(notification.userId, recipient.id));
    expect(rows).toHaveLength(205);
    expect(rows.filter((row) => row.readAt === null)).toHaveLength(0);
  });

  it("leaves already-read rows on their first moment", async () => {
    const recipient = await insertUser();
    const actor = await insertUser({ firstName: "Alan", lastName: "Turing" });
    const issueRow = await insertIssueRow(actor.id);
    const firstMoment = new Date("2026-03-01T10:00:00.000Z");
    const alreadyRead = await insertNotification({
      userId: recipient.id,
      actorId: actor.id,
      issueId: issueRow.id,
      readAt: firstMoment,
    });

    await markAllNotificationsRead(recipient.id);

    expect((await readRow(alreadyRead.id)).readAt?.toISOString()).toBe(firstMoment.toISOString());
  });

  it("touches no other user's rows", async () => {
    const recipient = await insertUser();
    const stranger = await insertUser({ firstName: "Grace", lastName: "Hopper" });
    const actor = await insertUser({ firstName: "Alan", lastName: "Turing" });
    const issueRow = await insertIssueRow(actor.id);
    const foreign = await insertNotification({
      userId: stranger.id,
      actorId: actor.id,
      issueId: issueRow.id,
    });

    await markAllNotificationsRead(recipient.id);

    expect((await readRow(foreign.id)).readAt).toBeNull();
  });

  it("is a no-op rather than an error when pressed twice", async () => {
    const recipient = await insertUser();
    const actor = await insertUser({ firstName: "Alan", lastName: "Turing" });
    const issueRow = await insertIssueRow(actor.id);
    const row = await insertNotification({
      userId: recipient.id,
      actorId: actor.id,
      issueId: issueRow.id,
    });

    await markAllNotificationsRead(recipient.id);
    const firstMoment = (await readRow(row.id)).readAt;
    await expect(markAllNotificationsRead(recipient.id)).resolves.toBeUndefined();

    expect((await readRow(row.id)).readAt?.toISOString()).toBe(firstMoment?.toISOString());
  });
});