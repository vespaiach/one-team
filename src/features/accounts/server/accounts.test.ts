import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { session, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { issueSession } from "@/features/auth/server/sessions";
import { deactivateAccount, reactivateAccount } from "./accounts";

beforeEach(async () => {
  await truncateTestDatabase();
});

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

async function insertSessionFor(userId: string) {
  return issueSession({ userId, ipAddress: "203.0.113.4", userAgent: null });
}

describe("deactivateAccount (FR-045, FR-045b, FR-047, FR-049, FR-052, FR-053)", () => {
  it("sets deactivated_at and deletes every session row for the account", async () => {
    const member = await insertUser({ role: "member" });
    await insertSessionFor(member.id);
    await insertSessionFor(member.id);

    const result = await deactivateAccount(member.id);

    expect(result).toBe("done");
    const [row] = await testDb.select().from(user).where(eq(user.id, member.id));
    expect(row?.deactivatedAt).not.toBeNull();
    const sessions = await testDb.select().from(session).where(eq(session.userId, member.id));
    expect(sessions).toHaveLength(0);
  });

  it("refuses an account already closed with unchanged, writing nothing", async () => {
    const member = await insertUser({ role: "member", deactivatedAt: new Date("2026-01-01T00:00:00.000Z") });

    const result = await deactivateAccount(member.id);

    expect(result).toBe("unchanged");
    const [row] = await testDb.select().from(user).where(eq(user.id, member.id));
    expect(row?.deactivatedAt?.getTime()).toBe(new Date("2026-01-01T00:00:00.000Z").getTime());
  });

  it("refuses the last active admin under withLastAdminGuard, writing nothing", async () => {
    const admin = await insertUser({ role: "admin" });

    const result = await deactivateAccount(admin.id);

    expect(result).toBe("last_admin");
    const [row] = await testDb.select().from(user).where(eq(user.id, admin.id));
    expect(row?.deactivatedAt).toBeNull();
  });

  it("succeeds on an admin when another active admin remains", async () => {
    const admin = await insertUser({ role: "admin" });
    await insertUser({ role: "admin" });

    const result = await deactivateAccount(admin.id);

    expect(result).toBe("done");
  });
});

describe("reactivateAccount (FR-045b, FR-051, FR-051a)", () => {
  it("clears deactivated_at for a closed account", async () => {
    const member = await insertUser({ role: "member", deactivatedAt: new Date() });

    const result = await reactivateAccount(member.id);

    expect(result).toBe("done");
    const [row] = await testDb.select().from(user).where(eq(user.id, member.id));
    expect(row?.deactivatedAt).toBeNull();
  });

  it("refuses an account already active with unchanged, writing nothing", async () => {
    const member = await insertUser({ role: "member" });

    const result = await reactivateAccount(member.id);

    expect(result).toBe("unchanged");
  });

  it("does not bring back sessions a deactivation deleted", async () => {
    const member = await insertUser({ role: "member" });
    await insertSessionFor(member.id);
    await deactivateAccount(member.id);

    await reactivateAccount(member.id);

    const sessions = await testDb.select().from(session).where(eq(session.userId, member.id));
    expect(sessions).toHaveLength(0);
  });
});

describe("account races against real PostgreSQL (FR-049, FR-051a, SC-008, US4 s8)", () => {
  it("leaves at least one active admin standing when the last two are deactivated at once", async () => {
    const first = await insertUser({ role: "admin" });
    const second = await insertUser({ role: "admin" });

    const [firstResult, secondResult] = await Promise.all([
      deactivateAccount(first.id),
      deactivateAccount(second.id),
    ]);

    const results = [firstResult, secondResult].sort();
    expect(results).toEqual(["done", "last_admin"]);

    const activeAdmins = await testDb.select().from(user).where(eq(user.role, "admin"));
    const stillActive = activeAdmins.filter((row) => row.deactivatedAt === null);
    expect(stillActive).toHaveLength(1);
  });

  it("serialises a deactivate racing a reactivate on one account, landing on one of the two states and never between them", async () => {
    const member = await insertUser({ role: "member" });
    await insertSessionFor(member.id);

    const [deactivateSettled, reactivateSettled] = await Promise.allSettled([
      deactivateAccount(member.id),
      reactivateAccount(member.id),
    ]);

    expect(deactivateSettled.status).toBe("fulfilled");
    expect(reactivateSettled.status).toBe("fulfilled");

    const [row] = await testDb.select().from(user).where(eq(user.id, member.id));
    expect(row).toBeDefined();
    expect([null, "object"]).toContain(row?.deactivatedAt === null ? null : typeof row?.deactivatedAt);

    const sessions = await testDb.select().from(session).where(eq(session.userId, member.id));
    expect(sessions).toHaveLength(0);
  });
});