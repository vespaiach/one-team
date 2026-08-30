import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { session, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { deleteAllSessionsForUser, issueSession, resolveSession } from "./sessions";

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

describe("sessions (FR-010, FR-016, FR-017, FR-038, FR-054, SC-004, SC-008)", () => {
  it("a sign-in writes one row with expires_at = now + 30 days, storing only the digest", async () => {
    const owner = await insertUser();
    const now = new Date("2026-01-01T00:00:00.000Z");

    const { token, session: issued } = await issueSession({
      userId: owner.id,
      ipAddress: "203.0.113.4",
      userAgent: "test-agent",
      now,
    });

    expect(issued.expiresAt.getTime() - now.getTime()).toBe(30 * 24 * 60 * 60 * 1000);
    expect(issued.tokenDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(issued.tokenDigest).not.toBe(token);
  });

  it("resolving a session slides last_seen_at and expires_at forward", async () => {
    const owner = await insertUser();
    const issuedAt = new Date("2026-01-01T00:00:00.000Z");
    const { token } = await issueSession({
      userId: owner.id,
      ipAddress: "203.0.113.4",
      userAgent: null,
      now: issuedAt,
    });

    const usedAt = new Date("2026-01-10T00:00:00.000Z");
    const resolved = await resolveSession(token, usedAt);

    expect(resolved).not.toBeNull();
    expect(resolved?.lastSeenAt.getTime()).toBe(usedAt.getTime());
    expect(resolved?.expiresAt.getTime()).toBe(usedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
  });

  it("resolves to nothing for an unknown token or one past expiry", async () => {
    const owner = await insertUser();
    const issuedAt = new Date("2026-01-01T00:00:00.000Z");
    const { token } = await issueSession({
      userId: owner.id,
      ipAddress: "203.0.113.4",
      userAgent: null,
      now: issuedAt,
    });

    await expect(resolveSession("not-a-real-token")).resolves.toBeNull();

    const wayLater = new Date(issuedAt.getTime() + 31 * 24 * 60 * 60 * 1000);
    await expect(resolveSession(token, wayLater)).resolves.toBeNull();
  });

  it("deleteAllSessionsForUser removes every row for one user and none for any other", async () => {
    const owner = await insertUser();
    const other = await insertUser();
    const now = new Date();

    await issueSession({ userId: owner.id, ipAddress: "203.0.113.4", userAgent: null, now });
    await issueSession({ userId: owner.id, ipAddress: "203.0.113.5", userAgent: null, now });
    const { token: otherToken } = await issueSession({
      userId: other.id,
      ipAddress: "203.0.113.6",
      userAgent: null,
      now,
    });

    await deleteAllSessionsForUser(owner.id);

    const ownerSessions = await testDb.select().from(session).where(eq(session.userId, owner.id));
    expect(ownerSessions).toHaveLength(0);
    await expect(resolveSession(otherToken, now)).resolves.not.toBeNull();
  });
});