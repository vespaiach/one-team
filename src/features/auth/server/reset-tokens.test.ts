import { beforeEach, describe, expect, it } from "vitest";
import { user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { issueResetToken, resolveResetTokenState, spendResetToken } from "./reset-tokens";

beforeEach(async () => {
  await truncateTestDatabase();
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

describe("reset tokens (FR-033, FR-036, research C-8)", () => {
  it("issues a token as 32 CSPRNG bytes stored as a digest, expiring one hour after issue", async () => {
    const owner = await insertUser();
    const now = new Date("2026-01-01T00:00:00.000Z");

    const { token, resetToken: issued } = await issueResetToken({ userId: owner.id, now });

    expect(issued.tokenDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(issued.tokenDigest).not.toBe(token);
    expect(issued.expiresAt.getTime() - now.getTime()).toBe(60 * 60 * 1000);
  });

  it("resolves an unknown digest to unknown", async () => {
    await expect(resolveResetTokenState("not-a-real-token")).resolves.toEqual({
      state: "unknown",
      resetToken: null,
    });
  });

  it("resolves a fresh token to valid", async () => {
    const owner = await insertUser();
    const now = new Date("2026-01-01T00:00:00.000Z");
    const { token } = await issueResetToken({ userId: owner.id, now });

    const resolved = await resolveResetTokenState(token, now);

    expect(resolved.state).toBe("valid");
    expect(resolved.resetToken?.userId).toBe(owner.id);
  });

  it("resolves a token past its expiry to expired", async () => {
    const owner = await insertUser();
    const issuedAt = new Date("2026-01-01T00:00:00.000Z");
    const { token } = await issueResetToken({ userId: owner.id, now: issuedAt });

    const wayLater = new Date(issuedAt.getTime() + 61 * 60 * 1000);
    const resolved = await resolveResetTokenState(token, wayLater);

    expect(resolved.state).toBe("expired");
  });

  it("reports a token that is both used and expired as used, not expired (research C-8)", async () => {
    const owner = await insertUser();
    const issuedAt = new Date("2026-01-01T00:00:00.000Z");
    const { token, resetToken: issued } = await issueResetToken({ userId: owner.id, now: issuedAt });
    await spendResetToken(testDb, issued.id, issuedAt);

    const wayLater = new Date(issuedAt.getTime() + 61 * 60 * 1000);
    const resolved = await resolveResetTokenState(token, wayLater);

    expect(resolved.state).toBe("used");
  });
});

describe("spendResetToken (FR-037)", () => {
  it("spends via a conditional UPDATE, setting used_at on the first call", async () => {
    const owner = await insertUser();
    const { resetToken: issued } = await issueResetToken({ userId: owner.id });

    const spent = await spendResetToken(testDb, issued.id);

    expect(spent).not.toBeNull();
    expect(spent?.usedAt).not.toBeNull();
  });

  it("returns null on a second spend of the same token", async () => {
    const owner = await insertUser();
    const { resetToken: issued } = await issueResetToken({ userId: owner.id });

    await spendResetToken(testDb, issued.id);
    const secondSpend = await spendResetToken(testDb, issued.id);

    expect(secondSpend).toBeNull();
  });

  it("leaves exactly one winner when two spends of one token race", async () => {
    const owner = await insertUser();
    const { resetToken: issued } = await issueResetToken({ userId: owner.id });

    const results = await Promise.all([
      spendResetToken(testDb, issued.id),
      spendResetToken(testDb, issued.id),
    ]);
    const winners = results.filter((result) => result !== null);

    expect(winners).toHaveLength(1);
  });

  it("spending one of two outstanding tokens for the same address leaves the other usable", async () => {
    const owner = await insertUser();
    const first = await issueResetToken({ userId: owner.id });
    const second = await issueResetToken({ userId: owner.id });

    await spendResetToken(testDb, first.resetToken.id);

    const firstState = await resolveResetTokenState(first.token);
    const secondState = await resolveResetTokenState(second.token);
    expect(firstState.state).toBe("used");
    expect(secondState.state).toBe("valid");
  });
});