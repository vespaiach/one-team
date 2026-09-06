import nodemailer from "nodemailer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { boardColumn, comment, issue, notification, project, projectMember, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { sendNotificationMail } from "./mail";

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

function acceptingTransport() {
  const sendMail = vi.fn().mockResolvedValue(undefined);
  vi.spyOn(nodemailer, "createTransport").mockReturnValue({ sendMail } as unknown as ReturnType<
    typeof nodemailer.createTransport
  >);
  return sendMail;
}

function refusingTransport() {
  const sendMail = vi.fn().mockRejectedValue(new Error("connection refused"));
  vi.spyOn(nodemailer, "createTransport").mockReturnValue({ sendMail } as unknown as ReturnType<
    typeof nodemailer.createTransport
  >);
  return sendMail;
}

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

async function insertProject() {
  const now = new Date();
  const [row] = await testDb
    .insert(project)
    .values({
      key: `P${crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      name: "Website Redesign",
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!row) {
    throw new Error("insertProject produced no row");
  }
  return row;
}

async function insertIssueRow(projectId: string, createdBy: string) {
  const now = new Date();
  const [column] = await testDb
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
  if (!column) {
    throw new Error("insertColumn produced no row");
  }
  const [row] = await testDb
    .insert(issue)
    .values({
      projectId,
      number: 7,
      title: "Fix the header",
      columnId: column.id,
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
    .values({ authorId, body: "please look", ...target, createdAt: now, updatedAt: now })
    .returning();
  if (!row) {
    throw new Error("insertComment produced no row");
  }
  return row;
}

type NotificationSeed = Omit<typeof notification.$inferInsert, "createdAt" | "updatedAt"> & {
  createdAt?: Date;
  updatedAt?: Date;
};

async function insertNotification(values: NotificationSeed) {
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

async function readNotification(id: string) {
  const rows = await testDb.select().from(notification);
  const row = rows.find((candidate) => candidate.id === id);
  if (!row) {
    throw new Error("readNotification found no row");
  }
  return row;
}

function linkIn(text: string): URL {
  const match = text.match(/https?:\/\/\S+/);
  if (!match) {
    throw new Error(`no link in message body: ${text}`);
  }
  return new URL(match[0]);
}

describe("sendNotificationMail — the message (FR-063, FR-069, research D-6, D-7)", () => {
  it("sends one plain-text message naming the actor, what happened, the issue and the deep link", async () => {
    const sendMail = acceptingTransport();
    const recipient = await insertUser({ firstName: "Grace", lastName: "Hopper" });
    const actorRow = await insertUser({ firstName: "Alan", lastName: "Turing" });
    const proj = await insertProject();
    const issueRow = await insertIssueRow(proj.id, actorRow.id);
    const commentRow = await insertComment(actorRow.id, { issueId: issueRow.id });
    const row = await insertNotification({
      userId: recipient.id,
      actorId: actorRow.id,
      type: "mention",
      issueId: issueRow.id,
      commentId: commentRow.id,
    });

    await sendNotificationMail(row.id);

    expect(sendMail).toHaveBeenCalledTimes(1);
    const message = sendMail.mock.calls[0]?.[0];
    expect(message.to).toBe(recipient.email);
    expect(message).not.toHaveProperty("html");
    expect(String(message.subject)).toContain("Alan Turing");
    expect(String(message.subject)).toContain(`${proj.key}-7`);
    expect(String(message.text)).toContain("Alan Turing");
    expect(String(message.text)).toContain("Fix the header");

    const link = linkIn(String(message.text));
    expect(link.origin).toBe("https://app.example.com");
    expect(link.pathname).toBe(`/projects/${proj.key}/issues/7/details`);
    expect(link.hash).toBe(`#comment-${commentRow.id}`);
    expect(link.search).toBe("");
  });

  it("carries no query string, token, session or configuration detail anywhere in the message", async () => {
    const sendMail = acceptingTransport();
    const recipient = await insertUser();
    const actorRow = await insertUser();
    const proj = await insertProject();
    const issueRow = await insertIssueRow(proj.id, actorRow.id);
    const row = await insertNotification({
      userId: recipient.id,
      actorId: actorRow.id,
      type: "assignment",
      issueId: issueRow.id,
    });

    await sendNotificationMail(row.id);

    const message = sendMail.mock.calls[0]?.[0];
    const whole = `${message.subject}\n${message.text}`;
    expect(whole).not.toContain("?");
    expect(whole).not.toContain("smtp://");
    expect(whole).not.toContain("no-reply@example.com");
    expect(whole).not.toContain(row.id);
    expect(linkIn(String(message.text)).hash).toBe("");
  });

  it("names the project and its own path when the notification hangs off a project", async () => {
    const sendMail = acceptingTransport();
    const recipient = await insertUser();
    const actorRow = await insertUser();
    const proj = await insertProject();
    const now = new Date();
    await testDb
      .insert(projectMember)
      .values({ projectId: proj.id, userId: recipient.id, createdAt: now, updatedAt: now });
    const commentRow = await insertComment(actorRow.id, { projectId: proj.id });
    const row = await insertNotification({
      userId: recipient.id,
      actorId: actorRow.id,
      type: "comment",
      projectId: proj.id,
      commentId: commentRow.id,
    });

    await sendNotificationMail(row.id);

    const message = sendMail.mock.calls[0]?.[0];
    expect(String(message.text)).toContain("Website Redesign");
    const link = linkIn(String(message.text));
    expect(link.pathname).toBe(`/projects/${proj.key}/details`);
    expect(link.hash).toBe(`#comment-${commentRow.id}`);
  });
});

describe("sendNotificationMail — what it refuses to send (FR-066, FR-067)", () => {
  it("sends nothing when the row is gone", async () => {
    const sendMail = acceptingTransport();

    await sendNotificationMail(crypto.randomUUID());

    expect(sendMail).not.toHaveBeenCalled();
  });

  it("sends nothing when the row already carries emailed_at", async () => {
    const sendMail = acceptingTransport();
    const recipient = await insertUser();
    const actorRow = await insertUser();
    const proj = await insertProject();
    const issueRow = await insertIssueRow(proj.id, actorRow.id);
    const stampedAt = new Date("2026-01-01T00:00:00.000Z");
    const row = await insertNotification({
      userId: recipient.id,
      actorId: actorRow.id,
      type: "assignment",
      issueId: issueRow.id,
      emailedAt: stampedAt,
      sendAttempts: 1,
    });

    await sendNotificationMail(row.id);

    expect(sendMail).not.toHaveBeenCalled();
    const after = await readNotification(row.id);
    expect(after.sendAttempts).toBe(1);
    expect(after.emailedAt?.toISOString()).toBe(stampedAt.toISOString());
  });
});

describe("sendNotificationMail — recording the attempt (FR-066, FR-071, research D-3)", () => {
  it("stamps emailed_at and increments send_attempts together when the host accepts", async () => {
    acceptingTransport();
    const recipient = await insertUser();
    const actorRow = await insertUser();
    const proj = await insertProject();
    const issueRow = await insertIssueRow(proj.id, actorRow.id);
    const row = await insertNotification({
      userId: recipient.id,
      actorId: actorRow.id,
      type: "assignment",
      issueId: issueRow.id,
    });

    await sendNotificationMail(row.id);

    const after = await readNotification(row.id);
    expect(after.emailedAt).not.toBeNull();
    expect(after.sendAttempts).toBe(1);
    expect(lines).toEqual([]);
  });

  it("increments send_attempts alone and logs the failure when the host refuses", async () => {
    refusingTransport();
    const recipient = await insertUser();
    const actorRow = await insertUser();
    const proj = await insertProject();
    const issueRow = await insertIssueRow(proj.id, actorRow.id);
    const row = await insertNotification({
      userId: recipient.id,
      actorId: actorRow.id,
      type: "assignment",
      issueId: issueRow.id,
    });

    await sendNotificationMail(row.id);

    const after = await readNotification(row.id);
    expect(after.emailedAt).toBeNull();
    expect(after.sendAttempts).toBe(1);
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] ?? "{}").event).toBe("mail_send_failure");
  });
});