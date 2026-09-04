import { beforeEach, describe, expect, it } from "vitest";
import { user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { resolveMentions } from "./mention-resolve";

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

describe("resolveMentions (FR-022, FR-023, research E-1)", () => {
  it("resolves a single @[<user_id>] token to that user's current display name", async () => {
    const ada = await insertUser({ firstName: "Ada", lastName: "Lovelace" });

    const names = await resolveMentions(`Hey @[${ada.id}], can you take a look?`);

    expect(names.get(ada.id)).toBe("Ada Lovelace");
  });

  it("resolves every distinct id named in the body, batched in one query", async () => {
    const ada = await insertUser({ firstName: "Ada", lastName: "Lovelace" });
    const alan = await insertUser({ firstName: "Alan", lastName: "Turing" });

    const names = await resolveMentions(`@[${ada.id}] and @[${alan.id}], please review.`);

    expect(names.get(ada.id)).toBe("Ada Lovelace");
    expect(names.get(alan.id)).toBe("Alan Turing");
    expect(names.size).toBe(2);
  });

  it("resolves the same id once even when mentioned twice in one body", async () => {
    const ada = await insertUser({ firstName: "Ada", lastName: "Lovelace" });

    const names = await resolveMentions(`@[${ada.id}] again, @[${ada.id}]?`);

    expect(names.size).toBe(1);
    expect(names.get(ada.id)).toBe("Ada Lovelace");
  });

  it("resolves a mention for a user later deactivated, independent of deactivated_at", async () => {
    const retired = await insertUser({
      firstName: "Retired",
      lastName: "Member",
      deactivatedAt: new Date(),
    });

    const names = await resolveMentions(`Ask @[${retired.id}] about this.`);

    expect(names.get(retired.id)).toBe("Retired Member");
  });

  it("returns an empty map for a body carrying no mention token", async () => {
    const names = await resolveMentions("No mentions here.");

    expect(names.size).toBe(0);
  });
});