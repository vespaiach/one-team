import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { invite, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { digestToken } from "@/features/auth/server/crypto";
import {
  issueInvitation,
  resendInvitation,
  resolveInvitationState,
  revokeInvitation,
  spendInvitation,
} from "./invitations";

beforeEach(async () => {
  await truncateTestDatabase();
});

async function insertAdmin() {
  const now = new Date();
  const [row] = await testDb
    .insert(user)
    .values({
      firstName: "Ada",
      lastName: "Lovelace",
      email: `admin-${crypto.randomUUID()}@example.com`,
      role: "admin",
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!row) {
    throw new Error("insertAdmin produced no row");
  }
  return row;
}

describe("issueInvitation (FR-013, FR-014)", () => {
  it("writes one row whose expires_at is seven days out, storing only the digest of the token, and records the calling admin", async () => {
    const admin = await insertAdmin();
    const now = new Date("2026-01-01T00:00:00.000Z");
    const email = `invitee-${crypto.randomUUID()}@example.com`;

    const { token, invitation } = await issueInvitation({ email, invitedBy: admin.id, now });

    expect(invitation.email).toBe(email);
    expect(invitation.invitedBy).toBe(admin.id);
    expect(invitation.expiresAt.getTime() - now.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
    expect(invitation.tokenDigest).toBe(digestToken(token));
    expect(invitation.tokenDigest).not.toBe(token);
    expect(invitation.acceptedAt).toBeNull();

    const rows = await testDb.select().from(invite);
    expect(rows).toHaveLength(1);
  });
});

describe("resendInvitation (FR-020, FR-020a, FR-021a)", () => {
  it("replaces the digest and restarts the seven days on the existing row, touching updated_at", async () => {
    const admin = await insertAdmin();
    const issuedAt = new Date("2026-01-01T00:00:00.000Z");
    const { token: firstToken, invitation: issued } = await issueInvitation({
      email: `invitee-${crypto.randomUUID()}@example.com`,
      invitedBy: admin.id,
      now: issuedAt,
    });

    const resentAt = new Date("2026-01-03T00:00:00.000Z");
    const result = await resendInvitation(issued.id, resentAt);
    if (!result) {
      throw new Error("resendInvitation produced no result");
    }

    expect(result.invitation.id).toBe(issued.id);
    expect(result.invitation.tokenDigest).not.toBe(issued.tokenDigest);
    expect(result.invitation.tokenDigest).toBe(digestToken(result.token));
    expect(result.token).not.toBe(firstToken);
    expect(result.invitation.expiresAt.getTime() - resentAt.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
    expect(result.invitation.updatedAt.getTime()).toBe(resentAt.getTime());

    const rows = await testDb.select().from(invite);
    expect(rows).toHaveLength(1);
  });

  it("refuses a row that does not exist, writing nothing", async () => {
    const result = await resendInvitation("0198c1c0-0000-7000-8000-000000000000");
    expect(result).toBeNull();
  });

  it("refuses a row that is already accepted, writing nothing", async () => {
    const admin = await insertAdmin();
    const { invitation: issued } = await issueInvitation({
      email: `invitee-${crypto.randomUUID()}@example.com`,
      invitedBy: admin.id,
    });
    await testDb.update(invite).set({ acceptedAt: new Date() }).where(eq(invite.id, issued.id));

    const result = await resendInvitation(issued.id);

    expect(result).toBeNull();
    const [row] = await testDb.select().from(invite).where(eq(invite.id, issued.id));
    expect(row?.tokenDigest).toBe(issued.tokenDigest);
  });
});

describe("revokeInvitation (FR-021, FR-021a)", () => {
  it("deletes an unspent row", async () => {
    const admin = await insertAdmin();
    const { invitation: issued } = await issueInvitation({
      email: `invitee-${crypto.randomUUID()}@example.com`,
      invitedBy: admin.id,
    });

    const result = await revokeInvitation(issued.id);

    expect(result).toBe(true);
    const rows = await testDb.select().from(invite).where(eq(invite.id, issued.id));
    expect(rows).toHaveLength(0);
  });

  it("refuses a spent row, writing nothing", async () => {
    const admin = await insertAdmin();
    const { invitation: issued } = await issueInvitation({
      email: `invitee-${crypto.randomUUID()}@example.com`,
      invitedBy: admin.id,
    });
    await testDb.update(invite).set({ acceptedAt: new Date() }).where(eq(invite.id, issued.id));

    const result = await revokeInvitation(issued.id);

    expect(result).toBe(false);
    const rows = await testDb.select().from(invite).where(eq(invite.id, issued.id));
    expect(rows).toHaveLength(1);
  });

  it("refuses a row that does not exist", async () => {
    const result = await revokeInvitation("0198c1c0-0000-7000-8000-000000000000");
    expect(result).toBe(false);
  });
});

describe("resolveInvitationState (FR-031, FR-032, B-2, B-3)", () => {
  it("resolves an unknown token to unknown", async () => {
    const resolved = await resolveInvitationState("not-a-real-token");
    expect(resolved).toEqual({ state: "unknown", invitation: null });
  });

  it("resolves a fresh token to valid", async () => {
    const admin = await insertAdmin();
    const now = new Date("2026-01-01T00:00:00.000Z");
    const { token } = await issueInvitation({
      email: `invitee-${crypto.randomUUID()}@example.com`,
      invitedBy: admin.id,
      now,
    });

    const resolved = await resolveInvitationState(token, now);

    expect(resolved.state).toBe("valid");
  });

  it("resolves a token past its expiry to expired", async () => {
    const admin = await insertAdmin();
    const issuedAt = new Date("2026-01-01T00:00:00.000Z");
    const { token } = await issueInvitation({
      email: `invitee-${crypto.randomUUID()}@example.com`,
      invitedBy: admin.id,
      now: issuedAt,
    });

    const wayLater = new Date(issuedAt.getTime() + 8 * 24 * 60 * 60 * 1000);
    const resolved = await resolveInvitationState(token, wayLater);

    expect(resolved.state).toBe("expired");
  });

  it("reports a token that is both used and expired as used, not expired", async () => {
    const admin = await insertAdmin();
    const issuedAt = new Date("2026-01-01T00:00:00.000Z");
    const { token, invitation } = await issueInvitation({
      email: `invitee-${crypto.randomUUID()}@example.com`,
      invitedBy: admin.id,
      now: issuedAt,
    });
    await spendInvitation(testDb, invitation.id, issuedAt);

    const wayLater = new Date(issuedAt.getTime() + 8 * 24 * 60 * 60 * 1000);
    const resolved = await resolveInvitationState(token, wayLater);

    expect(resolved.state).toBe("used");
  });

  it("resolves a revoked invitation's token to unknown", async () => {
    const admin = await insertAdmin();
    const { token, invitation } = await issueInvitation({
      email: `invitee-${crypto.randomUUID()}@example.com`,
      invitedBy: admin.id,
    });
    await revokeInvitation(invitation.id);

    const resolved = await resolveInvitationState(token);

    expect(resolved).toEqual({ state: "unknown", invitation: null });
  });

  it("resolves a token superseded by a resend to unknown", async () => {
    const admin = await insertAdmin();
    const { token: originalToken, invitation } = await issueInvitation({
      email: `invitee-${crypto.randomUUID()}@example.com`,
      invitedBy: admin.id,
    });
    await resendInvitation(invitation.id);

    const resolved = await resolveInvitationState(originalToken);

    expect(resolved).toEqual({ state: "unknown", invitation: null });
  });
});

describe("spendInvitation (FR-031, FR-032)", () => {
  it("spends an unspent row, returning it", async () => {
    const admin = await insertAdmin();
    const { invitation } = await issueInvitation({
      email: `invitee-${crypto.randomUUID()}@example.com`,
      invitedBy: admin.id,
    });

    const spent = await spendInvitation(testDb, invitation.id);

    expect(spent).not.toBeNull();
    expect(spent?.acceptedAt).not.toBeNull();
  });

  it("returns nothing on a second spend of the same invitation", async () => {
    const admin = await insertAdmin();
    const { invitation } = await issueInvitation({
      email: `invitee-${crypto.randomUUID()}@example.com`,
      invitedBy: admin.id,
    });

    await spendInvitation(testDb, invitation.id);
    const secondSpend = await spendInvitation(testDb, invitation.id);

    expect(secondSpend).toBeNull();
  });

  it("leaves exactly one winner when two spends of one invitation race", async () => {
    const admin = await insertAdmin();
    const { invitation } = await issueInvitation({
      email: `invitee-${crypto.randomUUID()}@example.com`,
      invitedBy: admin.id,
    });

    const results = await Promise.all([
      spendInvitation(testDb, invitation.id),
      spendInvitation(testDb, invitation.id),
    ]);
    const winners = results.filter((result) => result !== null);

    expect(winners).toHaveLength(1);
  });
});