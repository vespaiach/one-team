import { eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { boardColumn, issue, notification, project, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { issueSession, SESSION_COOKIE_NAME } from "@/features/auth/server/sessions";

const { cookiesMock, refreshMock, redirectMock, markReadSpy, markAllReadSpy } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  refreshMock: vi.fn(),
  redirectMock: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  markReadSpy: vi.fn(),
  markAllReadSpy: vi.fn(),
}));

let currentOrigin: string | undefined = "https://app.example.com";

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
  headers: async () => new Headers(currentOrigin ? { origin: currentOrigin } : {}),
}));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));

vi.mock("next/cache", () => ({ refresh: refreshMock }));

vi.mock("@/features/notifications/server/mark-read", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./server/mark-read")>();
  return {
    ...actual,
    markNotificationRead: (params: { userId: string; notificationId: string }) => {
      markReadSpy(params);
      return actual.markNotificationRead(params);
    },
    markAllNotificationsRead: (userId: string) => {
      markAllReadSpy(userId);
      return actual.markAllNotificationsRead(userId);
    },
  };
});

const { markAllNotificationsRead, markNotificationRead } = await import("./actions");

beforeEach(async () => {
  await truncateTestDatabase();
  process.env.APP_URL = "https://app.example.com";
  currentOrigin = "https://app.example.com";
  cookiesMock.mockReset();
  refreshMock.mockReset();
  redirectMock.mockClear();
  markReadSpy.mockClear();
  markAllReadSpy.mockClear();
});

afterEach(() => {
  vi.resetModules();
});

function mockCookie(token: string | undefined): void {
  cookiesMock.mockResolvedValue({
    get: (name: string) =>
      name === SESSION_COOKIE_NAME && token !== undefined ? { value: token } : undefined,
  });
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

async function signInAs(row: { id: string }) {
  const { token } = await issueSession({
    userId: row.id,
    ipAddress: "203.0.113.4",
    userAgent: null,
  });
  mockCookie(token);
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

describe("markNotificationRead action preamble (FR-031, FR-072)", () => {
  it("runs the origin check before the actor is loaded and before the input is parsed", async () => {
    currentOrigin = "https://evil.example.com";
    mockCookie(undefined);

    await expect(markNotificationRead({ notificationId: 7 })).rejects.toThrow("forbidden_origin");
    expect(cookiesMock).not.toHaveBeenCalled();
    expect(markReadSpy).not.toHaveBeenCalled();
  });

  it("redirects an unauthenticated caller before the input is parsed", async () => {
    mockCookie(undefined);

    await expect(markNotificationRead({ notificationId: 7 })).rejects.toThrow("NEXT_REDIRECT:/signin");
    expect(markReadSpy).not.toHaveBeenCalled();
  });
});

describe("markNotificationRead input refusal (FR-031)", () => {
  it("refuses a non-string id without touching the database and without coercing it", async () => {
    const recipient = await insertUser();
    await signInAs(recipient);

    const result = await markNotificationRead({ notificationId: 7 });

    expect(result).toEqual({ status: "not-found" });
    expect(markReadSpy).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("refuses an empty id without touching the database", async () => {
    const recipient = await insertUser();
    await signInAs(recipient);

    const result = await markNotificationRead({ notificationId: "   " });

    expect(result).toEqual({ status: "not-found" });
    expect(markReadSpy).not.toHaveBeenCalled();
  });

  it("maps a non-UUID string reaching Postgres to not-found instead of a 500", async () => {
    const recipient = await insertUser();
    await signInAs(recipient);

    const result = await markNotificationRead({ notificationId: "not-a-uuid" });

    expect(result).toEqual({ status: "not-found" });
    expect(markReadSpy).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(result)).not.toContain("22P02");
  });
});

describe("markNotificationRead outcomes (FR-025, FR-026, FR-036, SC-002)", () => {
  it("marks the caller's own row and refreshes the shell", async () => {
    const recipient = await insertUser();
    const actor = await insertUser({ firstName: "Alan", lastName: "Turing" });
    const issueRow = await insertIssueRow(actor.id);
    const row = await insertNotification({
      userId: recipient.id,
      actorId: actor.id,
      issueId: issueRow.id,
    });
    await signInAs(recipient);

    const result = await markNotificationRead({ notificationId: row.id });

    expect(result).toEqual({ status: "ok" });
    expect(refreshMock).toHaveBeenCalledTimes(1);
    const [stored] = await testDb.select().from(notification).where(eq(notification.id, row.id));
    expect(stored?.readAt).not.toBeNull();
  });

  it("answers a foreign row exactly as it answers a missing one, and refreshes neither", async () => {
    const recipient = await insertUser();
    const stranger = await insertUser({ firstName: "Grace", lastName: "Hopper" });
    const actor = await insertUser({ firstName: "Alan", lastName: "Turing" });
    const issueRow = await insertIssueRow(actor.id);
    const foreign = await insertNotification({
      userId: stranger.id,
      actorId: actor.id,
      issueId: issueRow.id,
    });
    await signInAs(recipient);

    const foreignResult = await markNotificationRead({ notificationId: foreign.id });
    const missingResult = await markNotificationRead({ notificationId: uuidv7() });

    expect(foreignResult).toEqual(missingResult);
    expect(foreignResult).toEqual({ status: "not-found" });
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("returns a status and nothing else — no SQL, no configuration, no database detail", async () => {
    const recipient = await insertUser();
    const actor = await insertUser({ firstName: "Alan", lastName: "Turing" });
    const issueRow = await insertIssueRow(actor.id);
    const row = await insertNotification({
      userId: recipient.id,
      actorId: actor.id,
      issueId: issueRow.id,
    });
    await signInAs(recipient);

    const serialized = JSON.stringify(await markNotificationRead({ notificationId: row.id }));

    expect(serialized).toBe('{"status":"ok"}');
  });
});

describe("markAllNotificationsRead (FR-029, FR-030, FR-036, SC-011)", () => {
  it("declares no parameter, so a body sent alongside it changes nothing", async () => {
    const recipient = await insertUser();
    const stranger = await insertUser({ firstName: "Grace", lastName: "Hopper" });
    const actorRow = await insertUser({ firstName: "Alan", lastName: "Turing" });
    const issueRow = await insertIssueRow(actorRow.id);
    const foreign = await insertNotification({
      userId: stranger.id,
      actorId: actorRow.id,
      issueId: issueRow.id,
    });
    await signInAs(recipient);

    expect(markAllNotificationsRead.length).toBe(0);

    const withBody = markAllNotificationsRead as unknown as (input: unknown) => Promise<unknown>;
    const result = await withBody({ userId: stranger.id });

    expect(result).toEqual({ status: "ok" });
    expect(markAllReadSpy).toHaveBeenCalledWith(recipient.id);
    const [stored] = await testDb.select().from(notification).where(eq(notification.id, foreign.id));
    expect(stored?.readAt).toBeNull();
  });

  it("refreshes the shell unconditionally, even with nothing to clear", async () => {
    const recipient = await insertUser();
    await signInAs(recipient);

    const result = await markAllNotificationsRead();

    expect(result).toEqual({ status: "ok" });
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("runs the origin check and the actor load before it writes", async () => {
    currentOrigin = "https://evil.example.com";
    mockCookie(undefined);

    await expect(markAllNotificationsRead()).rejects.toThrow("forbidden_origin");
    expect(markAllReadSpy).not.toHaveBeenCalled();

    currentOrigin = "https://app.example.com";
    await expect(markAllNotificationsRead()).rejects.toThrow("NEXT_REDIRECT:/signin");
    expect(markAllReadSpy).not.toHaveBeenCalled();
  });
});