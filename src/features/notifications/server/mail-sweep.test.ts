import nodemailer from "nodemailer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { boardColumn, issue, notification, project, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { sweepNotificationMail } from "./mail-sweep";

const NOW = new Date("2026-03-01T12:00:00.000Z");
const MINUTE_MS = 60 * 1000;

const ORIGINAL_ENV = {
  APP_URL: process.env.APP_URL,
  SMTP_URL: process.env.SMTP_URL,
  MAIL_FROM: process.env.MAIL_FROM,
};

let sendMail: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  await truncateTestDatabase();
  process.env.APP_URL = "https://app.example.com";
  process.env.SMTP_URL = "smtp://localhost:1025";
  process.env.MAIL_FROM = "no-reply@example.com";
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  sendMail = vi.fn().mockRejectedValue(new Error("connection refused"));
  vi.spyOn(nodemailer, "createTransport").mockReturnValue({ sendMail } as unknown as ReturnType<
    typeof nodemailer.createTransport
  >);
});

afterEach(() => {
  process.env.APP_URL = ORIGINAL_ENV.APP_URL;
  process.env.SMTP_URL = ORIGINAL_ENV.SMTP_URL;
  process.env.MAIL_FROM = ORIGINAL_ENV.MAIL_FROM;
  vi.restoreAllMocks();
});

function minutesBefore(reference: Date, minutes: number): Date {
  return new Date(reference.getTime() - minutes * MINUTE_MS);
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

async function seedNotification(params: { ageMinutes: number; sendAttempts: number; emailedAt?: Date }) {
  const actorRow = await insertUser();
  const recipient = await insertUser();
  const issueRow = await insertIssueRow(actorRow.id);
  const createdAt = minutesBefore(NOW, params.ageMinutes);
  const [row] = await testDb
    .insert(notification)
    .values({
      userId: recipient.id,
      actorId: actorRow.id,
      type: "assignment",
      issueId: issueRow.id,
      sendAttempts: params.sendAttempts,
      emailedAt: params.emailedAt ?? null,
      createdAt,
      updatedAt: createdAt,
    })
    .returning();
  if (!row) {
    throw new Error("seedNotification produced no row");
  }
  return row;
}

async function readOnly(id: string) {
  const rows = await testDb.select().from(notification);
  const row = rows.find((candidate) => candidate.id === id);
  if (!row) {
    throw new Error("readOnly found no row");
  }
  return row;
}

describe("sweepNotificationMail — eligibility by row age (FR-067, FR-068, SC-014, research D-4)", () => {
  it("leaves a row with one attempt alone ten minutes in", async () => {
    const row = await seedNotification({ ageMinutes: 10, sendAttempts: 1 });

    await sweepNotificationMail(NOW);

    expect(sendMail).not.toHaveBeenCalled();
    expect(await readOnly(row.id)).toEqual(row);
  });

  it("leaves the count untouched however many times it runs inside those fifteen minutes", async () => {
    const row = await seedNotification({ ageMinutes: 10, sendAttempts: 1 });

    await sweepNotificationMail(NOW);
    await sweepNotificationMail(new Date(NOW.getTime() + 1 * MINUTE_MS));
    await sweepNotificationMail(new Date(NOW.getTime() + 2 * MINUTE_MS));
    await sweepNotificationMail(new Date(NOW.getTime() + 4 * MINUTE_MS));

    expect(sendMail).not.toHaveBeenCalled();
    expect((await readOnly(row.id)).sendAttempts).toBe(1);
  });

  it("attempts a row with one attempt once it is sixteen minutes old, taking the count to two", async () => {
    const row = await seedNotification({ ageMinutes: 16, sendAttempts: 1 });

    await sweepNotificationMail(NOW);

    expect(sendMail).toHaveBeenCalledTimes(1);
    const after = await readOnly(row.id);
    expect(after.sendAttempts).toBe(2);
    expect(after.emailedAt).toBeNull();
  });

  it("never attempts a row that has already reached four attempts", async () => {
    const row = await seedNotification({ ageMinutes: 50, sendAttempts: 4 });

    await sweepNotificationMail(NOW);

    expect(sendMail).not.toHaveBeenCalled();
    expect(await readOnly(row.id)).toEqual(row);
  });

  it("never attempts a row past an hour old, whatever the count reads", async () => {
    const row = await seedNotification({ ageMinutes: 61, sendAttempts: 2 });

    await sweepNotificationMail(NOW);

    expect(sendMail).not.toHaveBeenCalled();
    expect(await readOnly(row.id)).toEqual(row);
  });

  it("attempts a row whose immediate send never returned at once, at a count of zero", async () => {
    const row = await seedNotification({ ageMinutes: 1, sendAttempts: 0 });

    await sweepNotificationMail(NOW);

    expect(sendMail).toHaveBeenCalledTimes(1);
    expect((await readOnly(row.id)).sendAttempts).toBe(1);
  });

  it("never attempts an otherwise due row once emailed_at is set", async () => {
    const row = await seedNotification({
      ageMinutes: 16,
      sendAttempts: 1,
      emailedAt: minutesBefore(NOW, 16),
    });

    await sweepNotificationMail(NOW);

    expect(sendMail).not.toHaveBeenCalled();
    expect(await readOnly(row.id)).toEqual(row);
  });

  it("abandons a row after its fourth attempt without touching its in-app life", async () => {
    const row = await seedNotification({ ageMinutes: 46, sendAttempts: 3 });

    await sweepNotificationMail(NOW);
    const afterFourth = await readOnly(row.id);
    expect(afterFourth.sendAttempts).toBe(4);
    expect(afterFourth.readAt).toBeNull();

    await sweepNotificationMail(new Date(NOW.getTime() + 5 * MINUTE_MS));

    expect(sendMail).toHaveBeenCalledTimes(1);
    const abandoned = await readOnly(row.id);
    expect(abandoned.sendAttempts).toBe(4);
    expect(abandoned.type).toBe(row.type);
    expect(abandoned.issueId).toBe(row.issueId);
  });
});