import { eq } from "drizzle-orm";
import nodemailer from "nodemailer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { credential, invite, session, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { verifyPassword } from "@/features/auth/server/crypto";
import { issueSession, SESSION_COOKIE_NAME } from "@/features/auth/server/sessions";
import {
  acceptInvitation,
  checkInviteAddress,
  deactivateUser,
  inviteUser,
  reactivateUser,
  resendInvite,
  revokeInvite,
} from "./actions";
import { issueInvitation } from "./server/invitations";

let currentOrigin: string | undefined = "https://app.example.com";
const cookieJar = new Map<string, string>();
const revalidatedPaths: string[] = [];

vi.mock("next/headers", () => ({
  headers: async () => new Headers(currentOrigin ? { origin: currentOrigin } : {}),
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { value: cookieJar.get(name) } : undefined),
    set: (name: string, value: string) => {
      cookieJar.set(name, value);
    },
    delete: (name: string) => {
      cookieJar.delete(name);
    },
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
  unstable_rethrow: (error: unknown) => {
    if (error instanceof Error && error.message.startsWith("NEXT_REDIRECT:")) {
      throw error;
    }
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => {
    revalidatedPaths.push(path);
  },
}));

function mockMailTransport() {
  const sendMail = vi.fn().mockResolvedValue(undefined);
  vi.spyOn(nodemailer, "createTransport").mockReturnValue({ sendMail } as unknown as ReturnType<
    typeof nodemailer.createTransport
  >);
  return sendMail;
}

beforeEach(async () => {
  await truncateTestDatabase();
  process.env.APP_URL = "https://app.example.com";
  process.env.SMTP_URL = "smtp://localhost:1025";
  process.env.MAIL_FROM = "no-reply@example.com";
  currentOrigin = "https://app.example.com";
  cookieJar.clear();
  revalidatedPaths.length = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
});

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    data.append(key, value);
  }
  return data;
}

async function insertUser(overrides: Partial<typeof user.$inferInsert> = {}) {
  const now = new Date();
  const [row] = await testDb
    .insert(user)
    .values({
      firstName: "Ada",
      lastName: "Lovelace",
      email: `user-${crypto.randomUUID()}@example.com`,
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

async function signInAs(actor: { id: string }) {
  const { token } = await issueSession({ userId: actor.id, ipAddress: "203.0.113.4", userAgent: null });
  cookieJar.set(SESSION_COOKIE_NAME, token);
}

describe("checkInviteAddress (FR-006, FR-008a, FR-010, FR-060)", () => {
  it("returns ok for an address with no account and no outstanding invitation", async () => {
    const admin = await insertUser({ role: "admin" });
    await signInAs(admin);

    const result = await checkInviteAddress(`fresh-${crypto.randomUUID()}@example.com`);

    expect(result).toEqual({ result: "ok" });
  });

  it("returns malformed for an address that does not parse", async () => {
    const admin = await insertUser({ role: "admin" });
    await signInAs(admin);

    const result = await checkInviteAddress("not-an-email");

    expect(result).toEqual({ result: "malformed" });
  });

  it("returns has_account, folding case, distinguishing an active account", async () => {
    const admin = await insertUser({ role: "admin" });
    await signInAs(admin);
    const existing = await insertUser({ firstName: "Grace", lastName: "Hopper", email: "grace@example.com" });

    const result = await checkInviteAddress("GRACE@Example.com");

    expect(result).toEqual({
      result: "has_account",
      accountId: existing.id,
      displayName: "Grace Hopper",
      isDeactivated: false,
    });
  });

  it("returns has_account naming a deactivated account as such", async () => {
    const admin = await insertUser({ role: "admin" });
    await signInAs(admin);
    const existing = await insertUser({ email: "closed@example.com", deactivatedAt: new Date() });

    const result = await checkInviteAddress("closed@example.com");

    expect(result).toEqual({
      result: "has_account",
      accountId: existing.id,
      displayName: "Ada Lovelace",
      isDeactivated: true,
    });
  });

  it("returns has_invitation for an address already holding an outstanding invitation, folding case", async () => {
    const admin = await insertUser({ role: "admin" });
    await signInAs(admin);
    const now = new Date();
    const [issued] = await testDb
      .insert(invite)
      .values({
        email: "invitee@example.com",
        invitedBy: admin.id,
        tokenDigest: "a".repeat(64),
        expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const result = await checkInviteAddress("Invitee@Example.com");

    expect(result).toEqual({ result: "has_invitation", invitationId: issued?.id });
  });

  it("refuses a non-admin caller", async () => {
    const member = await insertUser({ role: "member" });
    await signInAs(member);

    await expect(checkInviteAddress("someone@example.com")).rejects.toThrow();
  });
});

describe("inviteUser (FR-009a, FR-012, FR-056, US1 s17)", () => {
  it("creates an invitation for a fresh address, mails it, and revalidates the screen", async () => {
    const admin = await insertUser({ role: "admin" });
    await signInAs(admin);
    mockMailTransport();
    const email = `fresh-${crypto.randomUUID()}@example.com`;

    const result = await inviteUser({ status: "idle" }, formData({ email }));

    expect(result).toEqual({ status: "created", mailed: true });
    const rows = await testDb.select().from(invite).where(eq(invite.email, email));
    expect(rows).toHaveLength(1);
    expect(revalidatedPaths).toContain("/settings/accounts");
  });

  it("returns created with mailed:false when the mail transport fails", async () => {
    const admin = await insertUser({ role: "admin" });
    await signInAs(admin);
    const sendMail = vi.fn().mockRejectedValue(new Error("connection refused"));
    vi.spyOn(nodemailer, "createTransport").mockReturnValue({ sendMail } as unknown as ReturnType<
      typeof nodemailer.createTransport
    >);

    const result = await inviteUser(
      { status: "idle" },
      formData({ email: `fresh-${crypto.randomUUID()}@example.com` }),
    );

    expect(result).toEqual({ status: "created", mailed: false });
  });

  it("returns malformed for an address that does not parse, writing nothing", async () => {
    const admin = await insertUser({ role: "admin" });
    await signInAs(admin);
    mockMailTransport();

    const result = await inviteUser({ status: "idle" }, formData({ email: "not-an-email" }));

    expect(result).toEqual({ status: "malformed" });
  });

  it("returns has_account for an address that already has one, writing nothing", async () => {
    const admin = await insertUser({ role: "admin" });
    await signInAs(admin);
    mockMailTransport();
    const existing = await insertUser({ email: "existing@example.com" });

    const result = await inviteUser({ status: "idle" }, formData({ email: "existing@example.com" }));

    expect(result).toEqual({
      status: "has_account",
      accountId: existing.id,
      displayName: "Ada Lovelace",
      isDeactivated: false,
    });
  });

  it("returns has_invitation for an address already invited, writing nothing new", async () => {
    const admin = await insertUser({ role: "admin" });
    await signInAs(admin);
    mockMailTransport();
    await inviteUser({ status: "idle" }, formData({ email: "invitee@example.com" }));
    revalidatedPaths.length = 0;

    const result = await inviteUser({ status: "idle" }, formData({ email: "invitee@example.com" }));

    expect(result.status).toBe("has_invitation");
    const rows = await testDb.select().from(invite).where(eq(invite.email, "invitee@example.com"));
    expect(rows).toHaveLength(1);
  });

  it("refuses a non-admin caller", async () => {
    const member = await insertUser({ role: "member" });
    await signInAs(member);
    mockMailTransport();

    await expect(
      inviteUser({ status: "idle" }, formData({ email: `fresh-${crypto.randomUUID()}@example.com` })),
    ).rejects.toThrow();
  });

  it("leaves exactly one row when two admins invite the same address concurrently, offering the loser resend rather than an error", async () => {
    const admin = await insertUser({ role: "admin" });
    await signInAs(admin);
    mockMailTransport();
    const email = `race-${crypto.randomUUID()}@example.com`;

    const [first, second] = await Promise.all([
      inviteUser({ status: "idle" }, formData({ email })),
      inviteUser({ status: "idle" }, formData({ email })),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual(["created", "has_invitation"]);

    const rows = await testDb.select().from(invite).where(eq(invite.email, email));
    expect(rows).toHaveLength(1);
  });
});

describe("resendInvite and revokeInvite (FR-012, FR-060, US1 s11)", () => {
  async function insertOutstandingInvite(invitedBy: string) {
    const now = new Date();
    const [row] = await testDb
      .insert(invite)
      .values({
        email: `invitee-${crypto.randomUUID()}@example.com`,
        invitedBy,
        tokenDigest: crypto.randomUUID().replace(/-/g, "").repeat(2),
        expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    if (!row) {
      throw new Error("insertOutstandingInvite produced no row");
    }
    return row;
  }

  it("resendInvite reissues the invitation's link and revalidates", async () => {
    const admin = await insertUser({ role: "admin" });
    await signInAs(admin);
    mockMailTransport();
    const issued = await insertOutstandingInvite(admin.id);

    const result = await resendInvite(issued.id);

    expect(result).toEqual({ status: "done", mailed: true });
    const [row] = await testDb.select().from(invite).where(eq(invite.id, issued.id));
    expect(row?.tokenDigest).not.toBe(issued.tokenDigest);
    expect(revalidatedPaths).toContain("/settings/accounts");
  });

  it("resendInvite refuses a row that does not exist, writing nothing", async () => {
    const admin = await insertUser({ role: "admin" });
    await signInAs(admin);
    mockMailTransport();

    const result = await resendInvite("0198c1c0-0000-7000-8000-000000000000");

    expect(result).toEqual({ status: "not_found" });
  });

  it("resendInvite refuses a member caller, deriving nothing from the client", async () => {
    const admin = await insertUser({ role: "admin" });
    const member = await insertUser({ role: "member" });
    await signInAs(member);
    mockMailTransport();
    const issued = await insertOutstandingInvite(admin.id);

    await expect(resendInvite(issued.id)).rejects.toThrow();

    const [row] = await testDb.select().from(invite).where(eq(invite.id, issued.id));
    expect(row?.tokenDigest).toBe(issued.tokenDigest);
  });

  it("revokeInvite deletes the row and revalidates", async () => {
    const admin = await insertUser({ role: "admin" });
    await signInAs(admin);
    const issued = await insertOutstandingInvite(admin.id);

    const result = await revokeInvite(issued.id);

    expect(result).toEqual({ status: "done" });
    const rows = await testDb.select().from(invite).where(eq(invite.id, issued.id));
    expect(rows).toHaveLength(0);
    expect(revalidatedPaths).toContain("/settings/accounts");
  });

  it("revokeInvite refuses a row that does not exist", async () => {
    const admin = await insertUser({ role: "admin" });
    await signInAs(admin);

    const result = await revokeInvite("0198c1c0-0000-7000-8000-000000000000");

    expect(result).toEqual({ status: "not_found" });
  });

  it("revokeInvite refuses a member caller, deriving nothing from the client", async () => {
    const admin = await insertUser({ role: "admin" });
    const member = await insertUser({ role: "member" });
    await signInAs(member);
    const issued = await insertOutstandingInvite(admin.id);

    await expect(revokeInvite(issued.id)).rejects.toThrow();

    const rows = await testDb.select().from(invite).where(eq(invite.id, issued.id));
    expect(rows).toHaveLength(1);
  });
});

function acceptFormData(overrides: Record<string, string> = {}): FormData {
  return formData({
    firstName: "Grace",
    lastName: "Hopper",
    password: "a-compliant-password-1",
    ...overrides,
  });
}

function isRedirectRejection(settled: PromiseSettledResult<unknown>): boolean {
  return (
    settled.status === "rejected" &&
    String((settled as PromiseRejectedResult).reason).includes("NEXT_REDIRECT:/home")
  );
}

describe("acceptInvitation (FR-024b, FR-027…FR-031, FR-033, FR-034)", () => {
  it("spends the invitation, writes user/credential/session in one transaction, sets the cookie, and redirects to /home", async () => {
    const admin = await insertUser({ role: "admin" });
    const email = `invitee-${crypto.randomUUID()}@example.com`;
    const { token } = await issueInvitation({ email, invitedBy: admin.id });

    await expect(acceptInvitation(token, { status: "idle" }, acceptFormData())).rejects.toThrow(
      "NEXT_REDIRECT:/home",
    );

    const [createdUser] = await testDb.select().from(user).where(eq(user.email, email));
    expect(createdUser?.role).toBe("member");
    expect(createdUser?.mustChangePassword).toBe(false);
    expect(createdUser?.firstName).toBe("Grace");
    expect(createdUser?.lastName).toBe("Hopper");

    const [createdCredential] = await testDb
      .select()
      .from(credential)
      .where(eq(credential.userId, createdUser?.id ?? ""));
    await expect(
      verifyPassword(createdCredential?.passwordHash ?? "", "a-compliant-password-1"),
    ).resolves.toBe(true);

    const sessions = await testDb
      .select()
      .from(session)
      .where(eq(session.userId, createdUser?.id ?? ""));
    expect(sessions).toHaveLength(1);
    expect(cookieJar.get(SESSION_COOKIE_NAME)).toBeDefined();

    const [spentInvite] = await testDb.select().from(invite).where(eq(invite.email, email));
    expect(spentInvite?.acceptedAt).not.toBeNull();
  });

  it("runs the password policy on the server whatever the form allowed", async () => {
    const admin = await insertUser({ role: "admin" });
    const { token } = await issueInvitation({
      email: `invitee-${crypto.randomUUID()}@example.com`,
      invitedBy: admin.id,
    });

    const result = await acceptInvitation(token, { status: "idle" }, acceptFormData({ password: "short1" }));

    expect(result).toEqual({ status: "policy", failure: "too_short" });
  });

  it("returns names when the first or last name is missing, writing nothing", async () => {
    const admin = await insertUser({ role: "admin" });
    const { token } = await issueInvitation({
      email: `invitee-${crypto.randomUUID()}@example.com`,
      invitedBy: admin.id,
    });

    const result = await acceptInvitation(token, { status: "idle" }, acceptFormData({ firstName: "" }));

    expect(result).toEqual({ status: "names" });
  });

  it("returns expired for an invitation past its seven days", async () => {
    const admin = await insertUser({ role: "admin" });
    const issuedAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    const { token } = await issueInvitation({
      email: `invitee-${crypto.randomUUID()}@example.com`,
      invitedBy: admin.id,
      now: issuedAt,
    });

    const result = await acceptInvitation(token, { status: "idle" }, acceptFormData());

    expect(result).toEqual({ status: "expired" });
  });

  it("returns unknown for a token matching no row", async () => {
    const result = await acceptInvitation("not-a-real-token", { status: "idle" }, acceptFormData());

    expect(result).toEqual({ status: "unknown" });
  });

  it("returns used for an already-spent invitation without reading any user row", async () => {
    const admin = await insertUser({ role: "admin" });
    const email = `invitee-${crypto.randomUUID()}@example.com`;
    const { token, invitation } = await issueInvitation({ email, invitedBy: admin.id });
    await testDb.update(invite).set({ acceptedAt: new Date() }).where(eq(invite.id, invitation.id));

    const result = await acceptInvitation(token, { status: "idle" }, acceptFormData());

    expect(result).toEqual({ status: "used" });
    const users = await testDb.select().from(user).where(eq(user.email, email));
    expect(users).toHaveLength(0);
  });

  it("returns taken when the address already has an account, writing no session", async () => {
    const admin = await insertUser({ role: "admin" });
    const email = `invitee-${crypto.randomUUID()}@example.com`;
    await insertUser({ email });
    const { token } = await issueInvitation({ email, invitedBy: admin.id });

    const result = await acceptInvitation(token, { status: "idle" }, acceptFormData());

    expect(result).toEqual({ status: "taken" });
    const users = await testDb.select().from(user).where(eq(user.email, email));
    expect(users).toHaveLength(1);
  });

  it("neither reuses, extends nor deletes a session the caller already held", async () => {
    const admin = await insertUser({ role: "admin" });
    const priorHolder = await insertUser();
    const { token: priorSessionToken } = await issueSession({
      userId: priorHolder.id,
      ipAddress: "203.0.113.4",
      userAgent: null,
    });
    cookieJar.set(SESSION_COOKIE_NAME, priorSessionToken);
    const email = `invitee-${crypto.randomUUID()}@example.com`;
    const { token } = await issueInvitation({ email, invitedBy: admin.id });

    await expect(acceptInvitation(token, { status: "idle" }, acceptFormData())).rejects.toThrow(
      "NEXT_REDIRECT:/home",
    );

    expect(cookieJar.get(SESSION_COOKIE_NAME)).not.toBe(priorSessionToken);
    const priorSessions = await testDb.select().from(session).where(eq(session.userId, priorHolder.id));
    expect(priorSessions).toHaveLength(1);
  });

  it("leaves exactly one user row and one used result when one link is accepted in two tabs at once", async () => {
    const admin = await insertUser({ role: "admin" });
    const email = `invitee-${crypto.randomUUID()}@example.com`;
    const { token } = await issueInvitation({ email, invitedBy: admin.id });

    const [first, second] = await Promise.allSettled([
      acceptInvitation(token, { status: "idle" }, acceptFormData()),
      acceptInvitation(token, { status: "idle" }, acceptFormData()),
    ]);

    const redirected = [first, second].filter(isRedirectRejection);
    expect(redirected).toHaveLength(1);
    const other = [first, second].find((settled) => !isRedirectRejection(settled));
    expect(other?.status).toBe("fulfilled");
    expect((other as PromiseFulfilledResult<unknown>).value).toEqual({ status: "used" });

    const users = await testDb.select().from(user).where(eq(user.email, email));
    expect(users).toHaveLength(1);
  });

  it("refuses with taken when the address acquires an account concurrently with acceptance", async () => {
    const admin = await insertUser({ role: "admin" });
    const email = `invitee-${crypto.randomUUID()}@example.com`;
    const { token } = await issueInvitation({ email, invitedBy: admin.id });
    const now = new Date();

    const [acceptSettled] = await Promise.allSettled([
      acceptInvitation(token, { status: "idle" }, acceptFormData()),
      testDb
        .insert(user)
        .values({ firstName: "Race", lastName: "Winner", email, createdAt: now, updatedAt: now }),
    ]);

    if (!isRedirectRejection(acceptSettled)) {
      expect(acceptSettled).toEqual({ status: "fulfilled", value: { status: "taken" } });
    }

    const users = await testDb.select().from(user).where(eq(user.email, email));
    expect(users).toHaveLength(1);
  });

  it("leaves the row dropped or spent, never both, when revoke races acceptance", async () => {
    const admin = await insertUser({ role: "admin" });
    const email = `invitee-${crypto.randomUUID()}@example.com`;
    const { token, invitation } = await issueInvitation({ email, invitedBy: admin.id });
    await signInAs(admin);

    const [acceptSettled] = await Promise.allSettled([
      acceptInvitation(token, { status: "idle" }, acceptFormData()),
      revokeInvite(invitation.id),
    ]);

    const rows = await testDb.select().from(invite).where(eq(invite.id, invitation.id));
    if (rows.length === 0) {
      expect(isRedirectRejection(acceptSettled)).toBe(false);
      expect(acceptSettled).toMatchObject({ status: "fulfilled", value: { status: "unknown" } });
    } else {
      expect(rows[0]?.acceptedAt).not.toBeNull();
      expect(isRedirectRejection(acceptSettled)).toBe(true);
    }
  });
});

describe("deactivateUser and reactivateUser (FR-043, FR-058, FR-060, FR-061)", () => {
  it("deactivateUser closes an active account and revalidates", async () => {
    const admin = await insertUser({ role: "admin" });
    await insertUser({ role: "admin" });
    await signInAs(admin);
    const target = await insertUser({ role: "member" });

    const result = await deactivateUser(target.id);

    expect(result).toEqual({ status: "done" });
    const [row] = await testDb.select().from(user).where(eq(user.id, target.id));
    expect(row?.deactivatedAt).not.toBeNull();
    expect(revalidatedPaths).toContain("/settings/accounts");
  });

  it("deactivateUser refuses the last active admin, writing nothing", async () => {
    const admin = await insertUser({ role: "admin" });
    await signInAs(admin);

    const result = await deactivateUser(admin.id);

    expect(result).toEqual({ status: "last_admin" });
    const [row] = await testDb.select().from(user).where(eq(user.id, admin.id));
    expect(row?.deactivatedAt).toBeNull();
  });

  it("deactivateUser refuses an account already closed with unchanged", async () => {
    const admin = await insertUser({ role: "admin" });
    await signInAs(admin);
    const target = await insertUser({ role: "member", deactivatedAt: new Date() });

    const result = await deactivateUser(target.id);

    expect(result).toEqual({ status: "unchanged" });
  });

  it("reactivateUser reopens a closed account and revalidates", async () => {
    const admin = await insertUser({ role: "admin" });
    await signInAs(admin);
    const target = await insertUser({ role: "member", deactivatedAt: new Date() });

    const result = await reactivateUser(target.id);

    expect(result).toEqual({ status: "done" });
    const [row] = await testDb.select().from(user).where(eq(user.id, target.id));
    expect(row?.deactivatedAt).toBeNull();
    expect(revalidatedPaths).toContain("/settings/accounts");
  });

  it("reactivateUser refuses an account already active with unchanged", async () => {
    const admin = await insertUser({ role: "admin" });
    await signInAs(admin);
    const target = await insertUser({ role: "member" });

    const result = await reactivateUser(target.id);

    expect(result).toEqual({ status: "unchanged" });
  });

  it("each refuses a non-admin caller with forbidden, writing nothing, deriving the subject from the stored row", async () => {
    const admin = await insertUser({ role: "admin" });
    const member = await insertUser({ role: "member" });
    await signInAs(member);
    const target = await insertUser({ role: "member" });

    const deactivateResult = await deactivateUser(target.id);
    const reactivateResult = await reactivateUser(admin.id);

    expect(deactivateResult).toEqual({ status: "forbidden" });
    expect(reactivateResult).toEqual({ status: "forbidden" });
    const [row] = await testDb.select().from(user).where(eq(user.id, target.id));
    expect(row?.deactivatedAt).toBeNull();
  });
});

describe("unhandled failures carry a generic message and never a secret (FR-024a, FR-063)", () => {
  it("resendInvite logs the invitation's id, never a token, and throws a generic error", async () => {
    const admin = await insertUser({ role: "admin" });
    await signInAs(admin);
    const issued = await insertOutstandingInviteFor(admin.id);
    const logSpy = vi.spyOn(await import("@/features/auth/server/log"), "logUnhandledServerError");
    vi.spyOn(
      await import("@/features/accounts/server/invitations"),
      "resendInvitation",
    ).mockRejectedValueOnce(new Error("connection to database lost at 10.0.0.5:5432"));

    await expect(resendInvite(issued.id)).rejects.toThrow(/something went wrong/i);

    expect(logSpy).toHaveBeenCalledWith(issued.id);
    const loggedValues = logSpy.mock.calls.flat();
    expect(loggedValues.join(" ")).not.toContain(issued.tokenDigest);
    expect(loggedValues.join(" ")).not.toContain("10.0.0.5");
  });

  it("revokeInvite logs the invitation's id and throws a generic error, never the database detail", async () => {
    const admin = await insertUser({ role: "admin" });
    await signInAs(admin);
    const issued = await insertOutstandingInviteFor(admin.id);
    const logSpy = vi.spyOn(await import("@/features/auth/server/log"), "logUnhandledServerError");
    vi.spyOn(
      await import("@/features/accounts/server/invitations"),
      "revokeInvitation",
    ).mockRejectedValueOnce(new Error('relation "invite" does not exist'));

    await expect(revokeInvite(issued.id)).rejects.toThrow(/something went wrong/i);

    expect(logSpy).toHaveBeenCalledWith(issued.id);
  });

  async function insertOutstandingInviteFor(invitedBy: string) {
    const now = new Date();
    const [row] = await testDb
      .insert(invite)
      .values({
        email: `invitee-${crypto.randomUUID()}@example.com`,
        invitedBy,
        tokenDigest: crypto.randomUUID().replace(/-/g, "").repeat(2),
        expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    if (!row) {
      throw new Error("insertOutstandingInviteFor produced no row");
    }
    return row;
  }
});

describe("self-closure (FR-045a)", () => {
  it("lets an admin close their own account when they are not the last active admin, redirecting to /signin", async () => {
    const admin = await insertUser({ role: "admin" });
    await insertUser({ role: "admin" });
    await signInAs(admin);
    await issueSession({ userId: admin.id, ipAddress: "203.0.113.5", userAgent: null });

    await expect(deactivateUser(admin.id)).rejects.toThrow("NEXT_REDIRECT:/signin");

    const [row] = await testDb.select().from(user).where(eq(user.id, admin.id));
    expect(row?.deactivatedAt).not.toBeNull();
    const sessions = await testDb.select().from(session).where(eq(session.userId, admin.id));
    expect(sessions).toHaveLength(0);
  });

  it("refuses self-closure of the last active admin", async () => {
    const admin = await insertUser({ role: "admin" });
    await signInAs(admin);

    const result = await deactivateUser(admin.id);

    expect(result).toEqual({ status: "last_admin" });
  });
});

describe("role demotion mid-session (FR-062, FR-002, OT-AUTHZ-012, OT-SEC-008)", () => {
  it("refuses the very next call and removes no row once the admin role is lost, reading user.role per request", async () => {
    const demoted = await insertUser({ role: "admin" });
    await insertUser({ role: "admin" });
    await signInAs(demoted);
    const target = await insertUser({ role: "member" });

    await testDb.update(user).set({ role: "member" }).where(eq(user.id, demoted.id));

    const result = await deactivateUser(target.id);

    expect(result).toEqual({ status: "forbidden" });
    const [row] = await testDb.select().from(user).where(eq(user.id, target.id));
    expect(row?.deactivatedAt).toBeNull();
  });
});