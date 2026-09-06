import nodemailer from "nodemailer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { boardColumn, comment, issue, notification, project, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { dispatchNotificationMail } from "./mail";

const ORIGINAL_ENV = {
  APP_URL: process.env.APP_URL,
  SMTP_URL: process.env.SMTP_URL,
  MAIL_FROM: process.env.MAIL_FROM,
};

let lines: string[] = [];

beforeEach(async () => {
  await truncateTestDatabase();
  process.env.APP_URL = "https://app.example.com";
  process.env.SMTP_URL = "smtp://localhost:1025";
  process.env.MAIL_FROM = "no-reply@example.com";
  lines = [];
  vi.spyOn(console, "error").mockImplementation((line: string) => {
    lines.push(line);
  });
});

afterEach(() => {
  process.env.APP_URL = ORIGINAL_ENV.APP_URL;
  process.env.SMTP_URL = ORIGINAL_ENV.SMTP_URL;
  process.env.MAIL_FROM = ORIGINAL_ENV.MAIL_FROM;
  vi.restoreAllMocks();
});

async function waitUntil(check: () => Promise<boolean>): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (await check()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("the dispatch never settled");
}

async function insertUser() {
  const now = new Date();
  const [row] = await testDb
    .insert(user)
    .values({
      firstName: "Ada",
      lastName: "Lovelace",
      email: `ada-${crypto.randomUUID()}@example.com`,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!row) {
    throw new Error("insertUser produced no row");
  }
  return row;
}

async function insertIssueRow(actorId: string) {
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
    throw new Error("insertProject produced no row");
  }
  const [column] = await testDb
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
  if (!column) {
    throw new Error("insertColumn produced no row");
  }
  const [row] = await testDb
    .insert(issue)
    .values({
      projectId: projectRow.id,
      number: 1,
      title: "Fix the header",
      columnId: column.id,
      createdBy: actorId,
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

async function insertCommentRow(authorId: string, issueId: string) {
  const now = new Date();
  const [row] = await testDb
    .insert(comment)
    .values({ authorId, body: "look here", issueId, createdAt: now, updatedAt: now })
    .returning();
  if (!row) {
    throw new Error("insertComment produced no row");
  }
  return row;
}

async function insertNotification(values: {
  userId: string;
  actorId: string;
  type: string;
  issueId: string;
  commentId: string | null;
}) {
  const now = new Date();
  const [row] = await testDb
    .insert(notification)
    .values({ ...values, sendAttempts: 0, createdAt: now, updatedAt: now })
    .returning();
  if (!row) {
    throw new Error("insertNotification produced no row");
  }
  return row;
}

async function census() {
  return testDb.select().from(notification);
}

describe("dispatchNotificationMail (FR-063, FR-065, FR-071, research D-2)", () => {
  it("returns undefined and leaves the row untouched while the send is still in flight", async () => {
    let releaseSend: () => void = () => undefined;
    const sendMail = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          releaseSend = () => resolve();
        }),
    );
    vi.spyOn(nodemailer, "createTransport").mockReturnValue({ sendMail } as unknown as ReturnType<
      typeof nodemailer.createTransport
    >);
    const actorRow = await insertUser();
    const recipient = await insertUser();
    const issueRow = await insertIssueRow(actorRow.id);
    const row = await insertNotification({
      userId: recipient.id,
      actorId: actorRow.id,
      type: "assignment",
      issueId: issueRow.id,
      commentId: null,
    });

    const returned = dispatchNotificationMail([row.id]);
    expect(returned).toBeUndefined();

    await waitUntil(async () => sendMail.mock.calls.length === 1);
    const midFlight = (await census())[0];
    expect(midFlight?.emailedAt).toBeNull();
    expect(midFlight?.sendAttempts).toBe(0);

    releaseSend();
    await waitUntil(async () => (await census())[0]?.sendAttempts === 1);
    expect((await census())[0]?.emailedAt).not.toBeNull();
  });

  it("does nothing at all for an empty array", async () => {
    const createTransport = vi.spyOn(nodemailer, "createTransport");
    const actorRow = await insertUser();
    const recipient = await insertUser();
    const issueRow = await insertIssueRow(actorRow.id);
    await insertNotification({
      userId: recipient.id,
      actorId: actorRow.id,
      type: "assignment",
      issueId: issueRow.id,
      commentId: null,
    });
    const before = await census();

    dispatchNotificationMail([]);
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(createTransport).not.toHaveBeenCalled();
    expect(await census()).toEqual(before);
    expect(lines).toEqual([]);
  });

  it("sends one message per id, addressed to that recipient alone, with no digest and no batching", async () => {
    const sendMail = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(nodemailer, "createTransport").mockReturnValue({ sendMail } as unknown as ReturnType<
      typeof nodemailer.createTransport
    >);
    const actorRow = await insertUser();
    const issueRow = await insertIssueRow(actorRow.id);
    const commentRow = await insertCommentRow(actorRow.id, issueRow.id);
    const recipients = [await insertUser(), await insertUser(), await insertUser()];
    const ids: string[] = [];
    for (const recipient of recipients) {
      const row = await insertNotification({
        userId: recipient.id,
        actorId: actorRow.id,
        type: "mention",
        issueId: issueRow.id,
        commentId: commentRow.id,
      });
      ids.push(row.id);
    }

    dispatchNotificationMail(ids);

    await waitUntil(async () => (await census()).every((row) => row.sendAttempts === 1));
    expect(sendMail).toHaveBeenCalledTimes(3);
    const addressed = sendMail.mock.calls.map((call) => String(call[0].to)).sort();
    expect(addressed).toEqual(recipients.map((recipient) => recipient.email).sort());
    for (const call of sendMail.mock.calls) {
      expect(String(call[0].to)).not.toContain(",");
    }
  });

  it("routes a rejected send to the unhandled-server-error log instead of an unhandled rejection", async () => {
    const sendMail = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(nodemailer, "createTransport").mockReturnValue({ sendMail } as unknown as ReturnType<
      typeof nodemailer.createTransport
    >);

    expect(() => dispatchNotificationMail(["not-a-uuid"])).not.toThrow();

    await waitUntil(async () => lines.length === 1);
    expect(JSON.parse(lines[0] ?? "{}").event).toBe("unhandled_server_error");
    expect(sendMail).not.toHaveBeenCalled();
  });
});