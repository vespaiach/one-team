import nodemailer from "nodemailer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { boardColumn, comment, issue, notification, project, projectMember, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { createComment } from "@/features/activity/server/create-comment";
import type { Actor } from "@/features/auth/server/actor";

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

async function seedMentionScene() {
  const proj = await insertProject();
  const author = await insertUser();
  const named = await insertUser();
  await addMember(proj.id, author.id);
  await addMember(proj.id, named.id);
  const issueRow = await insertIssueRow(proj.id, author.id);
  return { author, named, issueRow };
}

describe("a refusing mail host changes nothing about the write (FR-065, FR-070, FR-071, SC-013)", () => {
  it("commits the comment and its notification, and returns before the send has even settled", async () => {
    let releaseSend: () => void = () => undefined;
    const sendMail = vi.fn().mockImplementation(
      () =>
        new Promise<void>((_resolve, reject) => {
          releaseSend = () => reject(new Error("connection refused"));
        }),
    );
    vi.spyOn(nodemailer, "createTransport").mockReturnValue({ sendMail } as unknown as ReturnType<
      typeof nodemailer.createTransport
    >);
    const { author, named, issueRow } = await seedMentionScene();

    const result = await createComment({
      target: { issueId: issueRow.id },
      actor: actorFor(author),
      body: `@[${named.id}] please look`,
    });

    expect(result.status).toBe("ok");
    expect(await testDb.select().from(comment)).toHaveLength(1);
    const written = await testDb.select().from(notification);
    expect(written).toHaveLength(1);
    expect(written[0]?.userId).toBe(named.id);

    await waitUntil(async () => sendMail.mock.calls.length === 1);
    releaseSend();
    await waitUntil(async () => (await testDb.select().from(notification))[0]?.sendAttempts === 1);

    const settled = await testDb.select().from(notification);
    expect(settled[0]?.emailedAt).toBeNull();
    expect(lines.map((line) => JSON.parse(line).event)).toEqual(["mail_send_failure"]);
  });

  it("says nothing to the caller about the mail host", async () => {
    vi.spyOn(nodemailer, "createTransport").mockReturnValue({
      sendMail: vi.fn().mockRejectedValue(new Error("connection refused")),
    } as unknown as ReturnType<typeof nodemailer.createTransport>);
    const { author, named, issueRow } = await seedMentionScene();

    const result = await createComment({
      target: { issueId: issueRow.id },
      actor: actorFor(author),
      body: `@[${named.id}] please look`,
    });

    await waitUntil(async () => (await testDb.select().from(notification))[0]?.sendAttempts === 1);
    const rendered = JSON.stringify(result).toLowerCase();
    expect(rendered).not.toContain("mail");
    expect(rendered).not.toContain("smtp");
    expect(rendered).not.toContain("connection refused");
  });
});

describe("an unconfigured mail host changes nothing about the write (FR-070)", () => {
  it("commits the write, records the attempt and never reaches a transport", async () => {
    process.env.SMTP_URL = "";
    process.env.MAIL_FROM = "";
    const createTransport = vi.spyOn(nodemailer, "createTransport");
    const { author, named, issueRow } = await seedMentionScene();

    const result = await createComment({
      target: { issueId: issueRow.id },
      actor: actorFor(author),
      body: `@[${named.id}] please look`,
    });

    expect(result.status).toBe("ok");
    await waitUntil(async () => (await testDb.select().from(notification))[0]?.sendAttempts === 1);

    const settled = await testDb.select().from(notification);
    expect(settled).toHaveLength(1);
    expect(settled[0]?.emailedAt).toBeNull();
    expect(createTransport).not.toHaveBeenCalled();
    expect(lines.map((line) => JSON.parse(line).event)).toEqual(["mail_send_failure"]);
  });
});