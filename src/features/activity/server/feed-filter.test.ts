import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { activity, comment, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import type { Actor } from "@/features/auth/server/actor";
import { setFeedFilter } from "./feed-filter";

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

function actorFor(userRow: { id: string; role: string; firstName: string; lastName: string }): Actor {
  return {
    id: userRow.id,
    role: userRow.role,
    firstName: userRow.firstName,
    lastName: userRow.lastName,
    avatarUrl: null,
    mustChangePassword: false,
  };
}

describe("setFeedFilter — requires only the caller's own identity (FR-034, research C-6)", () => {
  it("updates the caller's own user.feed_filter", async () => {
    const actorRow = await insertUser({ feedFilter: "all" });

    const result = await setFeedFilter({ actor: actorFor(actorRow), filter: "comments" });

    expect(result).toEqual({ status: "ok" });
    const [row] = await testDb.select().from(user).where(eq(user.id, actorRow.id));
    expect(row?.feedFilter).toBe("comments");
  });

  it("leaves every other user's feed_filter untouched", async () => {
    const actorRow = await insertUser({ feedFilter: "all" });
    const otherRow = await insertUser({ feedFilter: "all" });

    await setFeedFilter({ actor: actorFor(actorRow), filter: "comments" });

    const [otherAfter] = await testDb.select().from(user).where(eq(user.id, otherRow.id));
    expect(otherAfter?.feedFilter).toBe("all");
  });

  it("writes no comment or activity row", async () => {
    const actorRow = await insertUser({ feedFilter: "all" });

    await setFeedFilter({ actor: actorFor(actorRow), filter: "comments" });

    const commentRows = await testDb.select().from(comment);
    const activityRows = await testDb.select().from(activity);
    expect(commentRows).toHaveLength(0);
    expect(activityRows).toHaveLength(0);
  });
});

describe("setFeedFilter — validated input boundary (Principle II)", () => {
  it("rejects a value other than 'comments' or 'all', and writes nothing", async () => {
    const actorRow = await insertUser({ feedFilter: "all" });

    const result = await setFeedFilter({ actor: actorFor(actorRow), filter: "everything" });

    expect(result).toEqual({ status: "invalid" });
    const [row] = await testDb.select().from(user).where(eq(user.id, actorRow.id));
    expect(row?.feedFilter).toBe("all");
  });
});