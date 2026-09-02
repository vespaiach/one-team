import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { credential, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { createCredential, findSignInCandidate, getUserEmail } from "./credentials";

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

async function insertCredential(userId: string, passwordHash: string) {
  const now = new Date();
  await testDb.insert(credential).values({ userId, passwordHash, createdAt: now, updatedAt: now });
}

describe("findSignInCandidate (FR-013, FR-062)", () => {
  it("returns no candidate for an unknown address", async () => {
    await truncateTestDatabase();

    await expect(findSignInCandidate("nobody@example.com")).resolves.toBeNull();
  });

  it("finds a candidate case-insensitively and returns its credential", async () => {
    await truncateTestDatabase();
    const owner = await insertUser({ email: "Ada@Example.com" });
    await insertCredential(owner.id, "hashed-value");

    const candidate = await findSignInCandidate("ada@example.com");

    expect(candidate).toEqual({
      userId: owner.id,
      role: owner.role,
      deactivatedAt: null,
      passwordHash: "hashed-value",
    });
  });

  it("returns a candidate with a null passwordHash when the account has no credential row", async () => {
    await truncateTestDatabase();
    const owner = await insertUser();

    const candidate = await findSignInCandidate(owner.email);

    expect(candidate).toEqual({
      userId: owner.id,
      role: owner.role,
      deactivatedAt: null,
      passwordHash: null,
    });
  });

  it("reports deactivatedAt for a closed account", async () => {
    await truncateTestDatabase();
    const deactivatedAt = new Date();
    const owner = await insertUser({ deactivatedAt });
    await insertCredential(owner.id, "hashed-value");

    const candidate = await findSignInCandidate(owner.email);

    expect(candidate?.deactivatedAt?.getTime()).toBe(deactivatedAt.getTime());
  });
});

describe("createCredential (F-6)", () => {
  it("inserts a credential row through the given executor", async () => {
    await truncateTestDatabase();
    const owner = await insertUser();

    await createCredential(testDb, { userId: owner.id, passwordHash: "hashed-value" });

    const [row] = await testDb.select().from(credential).where(eq(credential.userId, owner.id));
    expect(row?.passwordHash).toBe("hashed-value");
  });
});

describe("getUserEmail", () => {
  it("returns the address for a known user id", async () => {
    await truncateTestDatabase();
    const owner = await insertUser({ email: "jo@oneteam.io" });

    await expect(getUserEmail(owner.id)).resolves.toBe("jo@oneteam.io");
  });

  it("returns null for an id matching no user", async () => {
    await truncateTestDatabase();

    await expect(getUserEmail("0198c1c0-0000-7000-8000-000000000000")).resolves.toBeNull();
  });
});