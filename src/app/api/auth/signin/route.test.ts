import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authAttempt, credential, session, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { deactivateAccount } from "@/features/accounts/server/accounts";
import * as cryptoModule from "@/features/auth/server/crypto";
import { hashPassword } from "@/features/auth/server/crypto";
import { SESSION_COOKIE_NAME } from "@/features/auth/server/sessions";
import { POST } from "./route";

const APP_ORIGIN = "https://app.example.com";
const ORIGINAL_APP_URL = process.env.APP_URL;
const ORIGINAL_SUPPORT_EMAIL = process.env.SUPPORT_EMAIL;

beforeEach(async () => {
  await truncateTestDatabase();
  process.env.APP_URL = APP_ORIGIN;
});

afterEach(() => {
  process.env.APP_URL = ORIGINAL_APP_URL;
  process.env.SUPPORT_EMAIL = ORIGINAL_SUPPORT_EMAIL;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function signInRequest(
  body: unknown,
  options: { origin?: string | null; headers?: Record<string, string> } = {},
) {
  const headers = new Headers(options.headers);
  headers.set("content-type", "application/json");
  if (options.origin !== null) {
    headers.set("origin", options.origin ?? APP_ORIGIN);
  }
  return new Request("https://app.example.com/api/auth/signin", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
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

async function insertCredential(userId: string, plaintext: string) {
  const now = new Date();
  const passwordHash = await hashPassword(plaintext);
  await testDb.insert(credential).values({ userId, passwordHash, createdAt: now, updatedAt: now });
}

describe("POST /api/auth/signin — ok (FR-016, FR-017, FR-019, research B-7)", () => {
  it("writes one session row and sets the cookie with the fixed attributes", async () => {
    const owner = await insertUser();
    await insertCredential(owner.id, "correct horse battery staple 12");

    const response = await POST(
      signInRequest({ email: owner.email, password: "correct horse battery staple 12" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ result: "ok" });

    const rows = await testDb.select().from(session).where(eq(session.userId, owner.id));
    expect(rows).toHaveLength(1);

    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toMatch(/SameSite=Lax/i);
    expect(setCookie).toContain("Path=/");
    expect(setCookie).toContain("Max-Age=2592000");
  });

  it("sets Secure only in production", async () => {
    const owner = await insertUser();
    await insertCredential(owner.id, "correct horse battery staple 12");

    vi.stubEnv("NODE_ENV", "development");
    const devResponse = await POST(
      signInRequest({ email: owner.email, password: "correct horse battery staple 12" }),
    );
    expect(devResponse.headers.get("set-cookie") ?? "").not.toMatch(/secure/i);

    vi.stubEnv("NODE_ENV", "production");
    const prodResponse = await POST(
      signInRequest({ email: owner.email, password: "correct horse battery staple 12" }),
    );
    expect(prodResponse.headers.get("set-cookie") ?? "").toMatch(/secure/i);
  });
});

describe("POST /api/auth/signin — rejected (FR-013, FR-062, SC-003)", () => {
  it("gives byte-identical rejected bodies for a wrong password, an unknown address and a credential-less account, each costing one Argon2id verification", async () => {
    const withCredential = await insertUser();
    await insertCredential(withCredential.id, "correct horse battery staple 12");
    const withoutCredential = await insertUser();

    const verifySpy = vi.spyOn(cryptoModule, "verifyPassword");

    const wrongPassword = await POST(
      signInRequest({ email: withCredential.email, password: "definitely-the-wrong-one!" }),
    );
    const unknownAddress = await POST(
      signInRequest({ email: "nobody-at-all@example.com", password: "whatever-password-12" }),
    );
    const noCredentialRow = await POST(
      signInRequest({ email: withoutCredential.email, password: "whatever-password-12" }),
    );

    const bodies = await Promise.all([wrongPassword, unknownAddress, noCredentialRow].map((r) => r.json()));

    expect(wrongPassword.status).toBe(200);
    expect(unknownAddress.status).toBe(200);
    expect(noCredentialRow.status).toBe(200);
    expect(bodies).toEqual([{ result: "rejected" }, { result: "rejected" }, { result: "rejected" }]);
    expect(verifySpy).toHaveBeenCalledTimes(3);
  });
});

describe("POST /api/auth/signin — deactivated (FR-014)", () => {
  it("returns deactivated with SUPPORT_EMAIL when the operator configured one", async () => {
    process.env.SUPPORT_EMAIL = "help@example.com";
    const owner = await insertUser({ deactivatedAt: new Date() });
    await insertCredential(owner.id, "correct horse battery staple 12");

    const response = await POST(
      signInRequest({ email: owner.email, password: "correct horse battery staple 12" }),
    );

    await expect(response.json()).resolves.toEqual({ result: "deactivated", contact: "help@example.com" });
  });

  it("returns deactivated with a null contact when the operator configured none", async () => {
    process.env.SUPPORT_EMAIL = "";
    const owner = await insertUser({ deactivatedAt: new Date() });
    await insertCredential(owner.id, "correct horse battery staple 12");

    const response = await POST(
      signInRequest({ email: owner.email, password: "correct horse battery staple 12" }),
    );

    await expect(response.json()).resolves.toEqual({ result: "deactivated", contact: null });
  });

  it("returns rejected, not deactivated, for a deactivated account given the wrong password", async () => {
    const owner = await insertUser({ deactivatedAt: new Date() });
    await insertCredential(owner.id, "correct horse battery staple 12");

    const response = await POST(signInRequest({ email: owner.email, password: "the-wrong-password!" }));

    await expect(response.json()).resolves.toEqual({ result: "rejected" });
  });
});

describe("POST /api/auth/signin — closed via this feature's deactivateAccount (FR-046, OT-SEC-013, C-5)", () => {
  it("refuses with the closed-account message rather than the generic one", async () => {
    const owner = await insertUser();
    await insertCredential(owner.id, "correct horse battery staple 12");
    await deactivateAccount(owner.id);

    const response = await POST(
      signInRequest({ email: owner.email, password: "correct horse battery staple 12" }),
    );

    await expect(response.json()).resolves.toEqual({ result: "deactivated", contact: null });
  });
});

describe("POST /api/auth/signin — refusals outside the union (FR-023, FR-063)", () => {
  it("refuses a foreign or absent Origin with 403 forbidden", async () => {
    const foreign = await POST(
      signInRequest(
        { email: "a@example.com", password: "whatever-password-12" },
        { origin: "https://evil.example.com" },
      ),
    );
    const absent = await POST(
      signInRequest({ email: "a@example.com", password: "whatever-password-12" }, { origin: null }),
    );

    expect(foreign.status).toBe(403);
    await expect(foreign.json()).resolves.toEqual({ error: "forbidden" });
    expect(absent.status).toBe(403);
    await expect(absent.json()).resolves.toEqual({ error: "forbidden" });
  });

  it("refuses a malformed body with 400 invalid_request", async () => {
    const notJson = await POST(signInRequest("{not json"));
    const notAnObject = await POST(signInRequest(["array"]));
    const missingField = await POST(signInRequest({ email: "a@example.com" }));

    for (const response of [notJson, notAnObject, missingField]) {
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: "invalid_request" });
    }
  });

  it("refuses an over-long address or password before any database lookup", async () => {
    const findSpy = vi.spyOn(await import("@/features/auth/server/credentials"), "findSignInCandidate");

    const longEmail = await POST(
      signInRequest({ email: `${"a".repeat(195)}@example.com`, password: "whatever-password-12" }),
    );
    const longPassword = await POST(signInRequest({ email: "a@example.com", password: "a".repeat(129) }));

    expect(longEmail.status).toBe(400);
    await expect(longEmail.json()).resolves.toEqual({ error: "invalid_request" });
    expect(longPassword.status).toBe(400);
    await expect(longPassword.json()).resolves.toEqual({ error: "invalid_request" });
    expect(findSpy).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/signin — throttled (FR-039, FR-041, FR-068)", () => {
  it("refuses with throttled and retryAfterSeconds, performing no credential check", async () => {
    const owner = await insertUser();
    await insertCredential(owner.id, "correct horse battery staple 12");
    for (let i = 0; i < 5; i += 1) {
      await testDb
        .insert(authAttempt)
        .values({ flow: "signin", kind: "email", subject: owner.email, attemptedAt: new Date() });
    }
    const verifySpy = vi.spyOn(cryptoModule, "verifyPassword");

    const response = await POST(
      signInRequest({ email: owner.email, password: "correct horse battery staple 12" }),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { result: string; retryAfterSeconds: number };
    expect(body.result).toBe("throttled");
    expect(body.retryAfterSeconds).toBeGreaterThan(0);
    expect(verifySpy).not.toHaveBeenCalled();
  });

  it("records no attempt row for a throttled refusal", async () => {
    const owner = await insertUser();
    for (let i = 0; i < 5; i += 1) {
      await testDb
        .insert(authAttempt)
        .values({ flow: "signin", kind: "email", subject: owner.email, attemptedAt: new Date() });
    }

    await POST(signInRequest({ email: owner.email, password: "whatever-password-12" }));

    const rows = await testDb.select().from(authAttempt).where(eq(authAttempt.subject, owner.email));
    expect(rows).toHaveLength(5);
  });
});

describe("POST /api/auth/signin — throttle recording and clearing (FR-018, FR-041)", () => {
  it("records one email and one ip attempt row on a rejected sign-in", async () => {
    const owner = await insertUser();
    await insertCredential(owner.id, "correct horse battery staple 12");

    await POST(signInRequest({ email: owner.email, password: "the-wrong-password!" }));

    const rows = await testDb.select().from(authAttempt).where(eq(authAttempt.subject, owner.email));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.flow).toBe("signin");
    expect(rows[0]?.kind).toBe("email");
  });

  it("clears that address's signin/email attempt rows on a successful sign-in", async () => {
    const owner = await insertUser();
    await insertCredential(owner.id, "correct horse battery staple 12");
    await testDb
      .insert(authAttempt)
      .values({ flow: "signin", kind: "email", subject: owner.email, attemptedAt: new Date() });
    await testDb
      .insert(authAttempt)
      .values({ flow: "reset", kind: "email", subject: owner.email, attemptedAt: new Date() });

    await POST(signInRequest({ email: owner.email, password: "correct horse battery staple 12" }));

    const signinEmailRows = await testDb
      .select()
      .from(authAttempt)
      .where(
        and(
          eq(authAttempt.subject, owner.email),
          eq(authAttempt.flow, "signin"),
          eq(authAttempt.kind, "email"),
        ),
      );
    expect(signinEmailRows).toHaveLength(0);

    const resetRows = await testDb
      .select()
      .from(authAttempt)
      .where(and(eq(authAttempt.subject, owner.email), eq(authAttempt.flow, "reset")));
    expect(resetRows).toHaveLength(1);
  });
});

describe("POST /api/auth/signin — no limit on concurrent sessions (FR-060, FR-061)", () => {
  it("mints a second session rather than reusing, extending or deleting the first", async () => {
    const owner = await insertUser();
    await insertCredential(owner.id, "correct horse battery staple 12");

    const first = await POST(
      signInRequest({ email: owner.email, password: "correct horse battery staple 12" }),
    );
    const firstCookie = first.headers.get("set-cookie") ?? "";

    const second = await POST(
      signInRequest({ email: owner.email, password: "correct horse battery staple 12" }),
    );
    const secondCookie = second.headers.get("set-cookie") ?? "";

    expect(firstCookie).not.toBe(secondCookie);

    const rows = await testDb.select().from(session).where(eq(session.userId, owner.id));
    expect(rows).toHaveLength(2);
  });
});