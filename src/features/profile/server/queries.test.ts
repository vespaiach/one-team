import { beforeEach, describe, expect, it } from "vitest";
import { user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { getOwnProfile } from "./queries";

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

describe("getOwnProfile (FR-003, OT-DATA-005)", () => {
  it("reads the accountUser projection keyed by the given id", async () => {
    const owner = await insertUser({
      jobTitle: "Engineer",
      slackHandle: "@ada",
      phone: "+44 20 7946 0958",
      bio: "Line one\nLine two",
      avatarUrl: "https://example.com/a.png",
    });

    const record = await getOwnProfile(owner.id);

    expect(record).toEqual({
      avatarUrl: "https://example.com/a.png",
      firstName: "Ada",
      lastName: "Lovelace",
      jobTitle: "Engineer",
      slackHandle: "@ada",
      phone: "+44 20 7946 0958",
      bio: "Line one\nLine two",
      email: owner.email,
      role: "member",
    });
  });

  it("maps unset optional columns to null rather than omitting them", async () => {
    const owner = await insertUser();

    const record = await getOwnProfile(owner.id);

    expect(record?.avatarUrl).toBeNull();
    expect(record?.jobTitle).toBeNull();
    expect(record?.slackHandle).toBeNull();
    expect(record?.phone).toBeNull();
    expect(record?.bio).toBeNull();
  });

  it("drops id and deactivatedAt at the boundary", async () => {
    const owner = await insertUser();

    const record = await getOwnProfile(owner.id);

    expect(record).not.toHaveProperty("id");
    expect(record).not.toHaveProperty("deactivatedAt");
  });

  it("returns null for an id matching no row", async () => {
    const record = await getOwnProfile(crypto.randomUUID());

    expect(record).toBeNull();
  });

  it("never selects from the user table directly", async () => {
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("./queries.ts", import.meta.url), "utf8"),
    );
    expect(source).toContain("accountUser");
    expect(source).not.toMatch(/\.select\(\)\s*\.from\(user\)/);
  });

  it("reflects a role other than member", async () => {
    const owner = await insertUser({ role: "admin" });

    const record = await getOwnProfile(owner.id);

    expect(record?.role).toBe("admin");
  });

  it("is keyed by id and not affected by other rows", async () => {
    await insertUser();
    const owner = await insertUser();

    const record = await getOwnProfile(owner.id);

    expect(record?.email).toBe(owner.email);
  });
});