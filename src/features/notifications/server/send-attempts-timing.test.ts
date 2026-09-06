import nodemailer from "nodemailer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { boardColumn, issue, notification, project, projectMember, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { createComment } from "@/features/activity/server/create-comment";
import type { Actor } from "@/features/auth/server/actor";
import { sendNotificationMail } from "./mail";

const ORIGINAL_ENV = {
  APP_URL: process.env.APP_URL,
  SMTP_URL: process.env.SMTP_URL,
  MAIL_FROM: process.env.MAIL_FROM,
};

beforeEach(async () => {
  await truncateTestDatabase();
  process.env.APP_URL = "https://app.example.com";
  process.env.SMTP_URL = "smtp://localhost:1025";
  process.env.MAIL_FROM = "no-reply@example.com";
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  process.env.APP_URL = ORIGINAL_ENV.APP_URL;
  process.env.SMTP_URL = ORIGINAL_ENV.SMTP_URL;
  process.env.MAIL_FROM = ORIGINAL_ENV.MAIL_FROM;
  vi.restoreAllMocks();
});

function installTransport(sendMail: ReturnType<typeof vi.fn>) {
  vi.spyOn(nodemailer, "createTransport").mockReturnValue({ sendMail } as unknown as ReturnType<
    typeof nodemailer.createTransport
  >);
}

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
      number: 1,
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

async function addMember(projectId: string, userId: string) {
  const now = new Date();
  await testDb.insert(projectMember).values({ projectId, userId, createdAt: now, updatedAt: now });
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
  return testDb.select().from(notification);
}

async function seedMentionScene() {
  const proj = await insertProject();
  const author = await insertUser();
  const named = await insertUser();
  await addMember(proj.id, author.id);
  await addMember(proj.id, named.id);
  const issueRow = await insertIssueRow(proj.id, author.id);
  return { proj, author, named, issueRow };
}

describe("send_attempts is written after the attempt returns (FR-007, FR-064, FR-066, research F-2)", () => {
  it("reads zero the moment the causing transaction commits and one once the send has settled", async () => {
    let releaseSend: () => void = () => undefined;
    const sendMail = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          releaseSend = () => resolve();
        }),
    );
    installTransport(sendMail);
    const { author, named, issueRow } = await seedMentionScene();

    const result = await createComment({
      target: { issueId: issueRow.id },
      actor: actorFor(author),
      body: `@[${named.id}] please look`,
    });
    expect(result.status).toBe("ok");

    const committed = await census();
    expect(committed).toHaveLength(1);
    expect(committed[0]?.sendAttempts).toBe(0);
    expect(committed[0]?.emailedAt).toBeNull();

    await waitUntil(async () => sendMail.mock.calls.length === 1);
    const midSend = await census();
    expect(midSend[0]?.sendAttempts).toBe(0);

    releaseSend();
    await waitUntil(async () => (await census())[0]?.sendAttempts === 1);
    expect((await census())[0]?.emailedAt).not.toBeNull();
  });

  it("leaves emailed_at null with the count at one when the send fails", async () => {
    installTransport(vi.fn().mockRejectedValue(new Error("connection refused")));
    const { author, named, issueRow } = await seedMentionScene();

    await createComment({
      target: { issueId: issueRow.id },
      actor: actorFor(author),
      body: `@[${named.id}] please look`,
    });

    await waitUntil(async () => (await census())[0]?.sendAttempts === 1);
    const settled = await census();
    expect(settled).toHaveLength(1);
    expect(settled[0]?.emailedAt).toBeNull();
    expect(settled[0]?.sendAttempts).toBe(1);
  });

  it("produces one stamp and one increment when the same message is delivered twice", async () => {
    installTransport(vi.fn().mockResolvedValue(undefined));
    const { author, named, issueRow } = await seedMentionScene();

    await createComment({
      target: { issueId: issueRow.id },
      actor: actorFor(author),
      body: `@[${named.id}] please look`,
    });
    await waitUntil(async () => (await census())[0]?.sendAttempts === 1);
    await testDb.update(notification).set({ emailedAt: null, sendAttempts: 0 });

    const [row] = await census();
    if (!row) {
      throw new Error("no notification row to redeliver");
    }
    await Promise.all([sendNotificationMail(row.id), sendNotificationMail(row.id)]);

    const after = await census();
    expect(after).toHaveLength(1);
    expect(after[0]?.sendAttempts).toBe(1);
    expect(after[0]?.emailedAt).not.toBeNull();
  });
});