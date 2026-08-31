import { eq } from "drizzle-orm";
import nodemailer from "nodemailer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/auth/signin/route";
import { credential, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { completePasswordReset, requestPasswordReset } from "./actions";
import * as credentialsModule from "./server/credentials";
import { hashPassword } from "./server/crypto";

const APP_ORIGIN = "https://app.example.com";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ origin: APP_ORIGIN }),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

const ORIGINAL_ENV = {
  APP_URL: process.env.APP_URL,
  SMTP_URL: process.env.SMTP_URL,
  MAIL_FROM: process.env.MAIL_FROM,
};

beforeEach(async () => {
  await truncateTestDatabase();
  process.env.APP_URL = APP_ORIGIN;
  process.env.SMTP_URL = "smtp://localhost:1025";
  process.env.MAIL_FROM = "no-reply@example.com";
});

afterEach(() => {
  process.env.APP_URL = ORIGINAL_ENV.APP_URL;
  process.env.SMTP_URL = ORIGINAL_ENV.SMTP_URL;
  process.env.MAIL_FROM = ORIGINAL_ENV.MAIL_FROM;
  vi.restoreAllMocks();
});

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

async function insertCredential(userId: string, plaintext: string) {
  const now = new Date();
  await testDb.insert(credential).values({
    userId,
    passwordHash: await hashPassword(plaintext),
    createdAt: now,
    updatedAt: now,
  });
}

function signInRequest(body: unknown) {
  return new Request("https://app.example.com/api/auth/signin", {
    method: "POST",
    headers: { "content-type": "application/json", origin: APP_ORIGIN },
    body: JSON.stringify(body),
  });
}

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    data.append(key, value);
  }
  return data;
}

function mockMailTransport() {
  const sendMail = vi.fn().mockResolvedValue(undefined);
  vi.spyOn(nodemailer, "createTransport").mockReturnValue({ sendMail } as unknown as ReturnType<
    typeof nodemailer.createTransport
  >);
  return sendMail;
}

describe("no secret leaks across sign-in and reset (SC-010, FR-064)", () => {
  it("keeps the password, the stored hash, the session token and the reset token out of every response body and log line", async () => {
    const password = "correct horse battery staple 12";
    const owner = await insertUser();
    await insertCredential(owner.id, password);

    const logSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const sendMail = mockMailTransport();

    const okResponse = await POST(signInRequest({ email: owner.email, password }));
    const okBody = await okResponse.text();
    const setCookie = okResponse.headers.get("set-cookie") ?? "";
    const sessionToken = /one_team_session=([^;]+)/.exec(setCookie)?.[1] ?? "";
    expect(sessionToken.length).toBeGreaterThan(0);

    const rejectedResponse = await POST(
      signInRequest({ email: owner.email, password: "definitely-the-wrong-one!" }),
    );
    const rejectedBody = await rejectedResponse.text();

    const resetState = await requestPasswordReset({ status: "idle" }, formData({ email: owner.email }));
    expect(sendMail).toHaveBeenCalledTimes(1);
    const mailText = String(sendMail.mock.calls[0]?.[0]?.text ?? "");
    const resetToken = decodeURIComponent(/token=([^&\s]+)/.exec(mailText)?.[1] ?? "");
    expect(resetToken.length).toBeGreaterThan(0);

    const newPassword = "a perfectly compliant password 1";
    let completeState: unknown;
    try {
      completeState = await completePasswordReset(
        resetToken,
        { status: "idle" },
        formData({ password: newPassword, confirmPassword: newPassword }),
      );
    } catch (error) {
      if (!(error instanceof Error) || !error.message.startsWith("NEXT_REDIRECT:")) {
        throw error;
      }
      completeState = { status: "redirected" };
    }

    const [storedCredential] = await testDb.select().from(credential).where(eq(credential.userId, owner.id));
    const storedHash = storedCredential?.passwordHash ?? "";
    expect(storedHash.length).toBeGreaterThan(0);

    const haystacks = [
      okBody,
      rejectedBody,
      JSON.stringify(resetState),
      JSON.stringify(completeState),
      ...logSpy.mock.calls.map((call) => JSON.stringify(call)),
    ];

    for (const haystack of haystacks) {
      expect(haystack).not.toContain(password);
      expect(haystack).not.toContain(newPassword);
      expect(haystack).not.toContain(storedHash);
      expect(haystack).not.toContain(sessionToken);
      expect(haystack).not.toContain(resetToken);
    }

    expect(setCookie).not.toContain(password);
    expect(setCookie).not.toContain(storedHash);
    expect(setCookie).not.toContain(resetToken);
  });
});

describe("unhandled server error (FR-025, FR-064)", () => {
  it("answers a generic error and logs exactly one unhandled_server_error event, carrying no database detail", async () => {
    const owner = await insertUser();
    await insertCredential(owner.id, "correct horse battery staple 12");

    const secretDetail = 'password authentication failed for user "produrl_admin" at 10.20.30.40:5432';
    vi.spyOn(credentialsModule, "findSignInCandidate").mockRejectedValueOnce(new Error(secretDetail));
    const logSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await POST(
      signInRequest({ email: owner.email, password: "correct horse battery staple 12" }),
    );
    const bodyText = await response.text();

    expect(response.status).toBe(500);
    expect(bodyText).not.toContain(secretDetail);
    expect(bodyText).not.toContain("produrl_admin");
    expect(bodyText).not.toContain("10.20.30.40");

    const loggedLines = logSpy.mock.calls.map((call) => JSON.stringify(call));
    expect(loggedLines.some((line) => line.includes("unhandled_server_error"))).toBe(true);
    expect(loggedLines.some((line) => line.includes(secretDetail))).toBe(false);
  });
});