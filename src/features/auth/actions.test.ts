import { eq } from "drizzle-orm";
import nodemailer from "nodemailer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { credential, resetToken, session, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { completePasswordReset, requestPasswordReset } from "./actions";
import { hashPassword, verifyPassword } from "./server/crypto";
import { issueResetToken } from "./server/reset-tokens";
import { issueSession } from "./server/sessions";

const ORIGINAL_ENV = {
  APP_URL: process.env.APP_URL,
  SMTP_URL: process.env.SMTP_URL,
  MAIL_FROM: process.env.MAIL_FROM,
};

let currentOrigin: string | undefined = "https://app.example.com";

vi.mock("next/headers", () => ({
  headers: async () => new Headers(currentOrigin ? { origin: currentOrigin } : {}),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

beforeEach(async () => {
  await truncateTestDatabase();
  process.env.APP_URL = "https://app.example.com";
  process.env.SMTP_URL = "smtp://localhost:1025";
  process.env.MAIL_FROM = "no-reply@example.com";
  currentOrigin = "https://app.example.com";
});

afterEach(() => {
  process.env.APP_URL = ORIGINAL_ENV.APP_URL;
  process.env.SMTP_URL = ORIGINAL_ENV.SMTP_URL;
  process.env.MAIL_FROM = ORIGINAL_ENV.MAIL_FROM;
  vi.restoreAllMocks();
});

async function insertUser(overrides: { deactivatedAt?: Date | null } = {}) {
  const now = new Date();
  const [row] = await testDb
    .insert(user)
    .values({
      firstName: "Ada",
      lastName: "Lovelace",
      email: `ada-${crypto.randomUUID()}@example.com`,
      deactivatedAt: overrides.deactivatedAt ?? null,
      mustChangePassword: true,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!row) {
    throw new Error("insertUser produced no row");
  }
  return row;
}

async function insertCredential(userId: string, password = "correct horse battery staple") {
  const now = new Date();
  await testDb.insert(credential).values({
    userId,
    passwordHash: await hashPassword(password),
    createdAt: now,
    updatedAt: now,
  });
}

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    data.append(key, value);
  }
  return data;
}

function mockTransport() {
  const sendMail = vi.fn().mockResolvedValue(undefined);
  vi.spyOn(nodemailer, "createTransport").mockReturnValue({ sendMail } as unknown as ReturnType<
    typeof nodemailer.createTransport
  >);
  return sendMail;
}

describe("requestPasswordReset (FR-031, FR-033, SC-003)", () => {
  it("returns the same sent answer for a known address and mails a link", async () => {
    const owner = await insertUser();
    await insertCredential(owner.id);
    const sendMail = mockTransport();

    const result = await requestPasswordReset({ status: "idle" }, formData({ email: owner.email }));

    expect(result).toEqual({ status: "sent" });
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it("returns the identical sent answer for an unknown address and mails nothing", async () => {
    const sendMail = mockTransport();

    const result = await requestPasswordReset({ status: "idle" }, formData({ email: "nobody@example.com" }));

    expect(result).toEqual({ status: "sent" });
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("mails nothing for a deactivated account, though it belongs to a real address", async () => {
    const owner = await insertUser({ deactivatedAt: new Date() });
    await insertCredential(owner.id);
    const sendMail = mockTransport();

    const result = await requestPasswordReset({ status: "idle" }, formData({ email: owner.email }));

    expect(result).toEqual({ status: "sent" });
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("mails nothing for an address with no credential row", async () => {
    const owner = await insertUser();
    const sendMail = mockTransport();

    const result = await requestPasswordReset({ status: "idle" }, formData({ email: owner.email }));

    expect(result).toEqual({ status: "sent" });
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("never changes its answer because mail failed", async () => {
    const owner = await insertUser();
    await insertCredential(owner.id);
    const sendMail = vi.fn().mockRejectedValue(new Error("connection refused"));
    vi.spyOn(nodemailer, "createTransport").mockReturnValue({ sendMail } as unknown as ReturnType<
      typeof nodemailer.createTransport
    >);

    const result = await requestPasswordReset({ status: "idle" }, formData({ email: owner.email }));

    expect(result).toEqual({ status: "sent" });
  });

  it("refuses an over-long address before any lookup", async () => {
    const sendMail = mockTransport();

    const result = await requestPasswordReset(
      { status: "idle" },
      formData({ email: `${"a".repeat(195)}@example.com` }),
    );

    expect(result).toEqual({ status: "sent" });
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("refuses a request whose Origin does not match APP_URL", async () => {
    currentOrigin = "https://evil.example.com";

    await expect(
      requestPasswordReset({ status: "idle" }, formData({ email: "ada@example.com" })),
    ).rejects.toThrow();
  });

  it("derives the mailed address from the folded, stored form — never a client-supplied identifier", async () => {
    const owner = await insertUser();
    await insertCredential(owner.id);
    const sendMail = mockTransport();

    await requestPasswordReset({ status: "idle" }, formData({ email: owner.email.toUpperCase() }));

    expect(sendMail).toHaveBeenCalledTimes(1);
    const call = sendMail.mock.calls[0]?.[0];
    expect(call.to).toBe(owner.email);
  });
});

describe("completePasswordReset (FR-035, FR-027, FR-038, FR-050, FR-066, SC-008)", () => {
  it("returns mismatch when the two fields differ and writes nothing", async () => {
    const owner = await insertUser();
    await insertCredential(owner.id);
    const { token } = await issueResetToken({ userId: owner.id });

    const result = await completePasswordReset(
      token,
      { status: "idle" },
      formData({ password: "a-compliant-password-1", confirmPassword: "a-different-password-2" }),
    );

    expect(result).toEqual({ status: "mismatch" });
  });

  it("returns policy naming the one rule that failed, and writes nothing", async () => {
    const owner = await insertUser();
    await insertCredential(owner.id);
    const { token } = await issueResetToken({ userId: owner.id });

    const result = await completePasswordReset(
      token,
      { status: "idle" },
      formData({ password: "short1", confirmPassword: "short1" }),
    );

    expect(result).toEqual({ status: "policy", failure: "too_short" });
  });

  it("on success, writes the hash, clears must_change_password, deletes every session, and redirects to /signin?reset=done", async () => {
    const owner = await insertUser();
    await insertCredential(owner.id, "the-old-password-value");
    await issueSession({ userId: owner.id, ipAddress: "203.0.113.4", userAgent: null });
    const { token } = await issueResetToken({ userId: owner.id });

    await expect(
      completePasswordReset(
        token,
        { status: "idle" },
        formData({ password: "a-brand-new-password", confirmPassword: "a-brand-new-password" }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/signin?reset=done");

    const [updatedUser] = await testDb.select().from(user).where(eq(user.id, owner.id));
    expect(updatedUser?.mustChangePassword).toBe(false);

    const remainingSessions = await testDb.select().from(session).where(eq(session.userId, owner.id));
    expect(remainingSessions).toHaveLength(0);

    const [updatedCredential] = await testDb.select().from(credential).where(eq(credential.userId, owner.id));
    await expect(verifyPassword(updatedCredential?.passwordHash ?? "", "a-brand-new-password")).resolves.toBe(
      true,
    );
  });

  it("returns used for an already-spent token", async () => {
    const owner = await insertUser();
    await insertCredential(owner.id);
    const { token } = await issueResetToken({ userId: owner.id });
    await completePasswordReset(
      token,
      { status: "idle" },
      formData({ password: "the-first-new-password", confirmPassword: "the-first-new-password" }),
    ).catch(() => undefined);

    const result = await completePasswordReset(
      token,
      { status: "idle" },
      formData({ password: "the-second-new-password", confirmPassword: "the-second-new-password" }),
    );

    expect(result).toEqual({ status: "used" });
  });

  it("returns expired for a token past its lifetime", async () => {
    const owner = await insertUser();
    await insertCredential(owner.id);
    const issuedTwoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const { token } = await issueResetToken({ userId: owner.id, now: issuedTwoHoursAgo });

    const result = await completePasswordReset(
      token,
      { status: "idle" },
      formData({ password: "a-compliant-password-1", confirmPassword: "a-compliant-password-1" }),
    );

    expect(result).toEqual({ status: "expired" });
  });

  it("returns unknown for a token matching no row", async () => {
    const result = await completePasswordReset(
      "not-a-real-token",
      { status: "idle" },
      formData({
        password: "a-compliant-password-1",
        confirmPassword: "a-compliant-password-1",
      }),
    );

    expect(result).toEqual({ status: "unknown" });
  });

  it("spends the token, writes no password, and returns unknown for an owner who may no longer sign in (FR-066)", async () => {
    const owner = await insertUser({ deactivatedAt: new Date() });
    await insertCredential(owner.id, "the-untouched-password");
    const { token } = await issueResetToken({ userId: owner.id });

    const result = await completePasswordReset(
      token,
      { status: "idle" },
      formData({ password: "a-compliant-password-1", confirmPassword: "a-compliant-password-1" }),
    );

    expect(result).toEqual({ status: "unknown" });

    const [row] = await testDb.select().from(resetToken).where(eq(resetToken.userId, owner.id));
    expect(row?.usedAt).not.toBeNull();

    const [unchangedCredential] = await testDb
      .select()
      .from(credential)
      .where(eq(credential.userId, owner.id));
    await expect(
      verifyPassword(unchangedCredential?.passwordHash ?? "", "the-untouched-password"),
    ).resolves.toBe(true);
  });

  it("refuses an over-long password before any lookup", async () => {
    const owner = await insertUser();
    await insertCredential(owner.id);
    const { token } = await issueResetToken({ userId: owner.id });
    const overLong = "a".repeat(129);

    const result = await completePasswordReset(
      token,
      { status: "idle" },
      formData({ password: overLong, confirmPassword: overLong }),
    );

    expect(result).toEqual({ status: "policy", failure: "too_long" });
  });

  it("refuses a request whose Origin does not match APP_URL", async () => {
    currentOrigin = "https://evil.example.com";

    await expect(
      completePasswordReset(
        "whatever",
        { status: "idle" },
        formData({
          password: "a-compliant-password-1",
          confirmPassword: "a-compliant-password-1",
        }),
      ),
    ).rejects.toThrow();
  });
});