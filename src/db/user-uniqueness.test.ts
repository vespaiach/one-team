import { beforeEach, describe, expect, it } from "vitest";
import { user } from "./schema";
import { testDb, truncateTestDatabase } from "./test-database";

beforeEach(async () => {
  await truncateTestDatabase();
});

function newUser(email: string) {
  const now = new Date();
  return { firstName: "Ada", lastName: "Lovelace", email, createdAt: now, updatedAt: now };
}

describe("user email uniqueness (FR-006, FR-059, OT-INV-016)", () => {
  it("refuses two addresses differing only in case", async () => {
    await testDb.insert(user).values(newUser("ada@example.com"));

    await expect(testDb.insert(user).values(newUser("Ada@Example.com"))).rejects.toThrow();
  });

  it("allows two genuinely different addresses", async () => {
    await testDb.insert(user).values(newUser("ada@example.com"));

    await expect(testDb.insert(user).values(newUser("grace@example.com"))).resolves.toBeDefined();
  });

  it("surfaces a concurrent duplicate insert as a catchable violation, not an unhandled error", async () => {
    const email = "concurrent@example.com";

    const results = await Promise.allSettled([
      testDb.insert(user).values(newUser(email)),
      testDb.insert(user).values(newUser(email)),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
  });
});