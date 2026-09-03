import { uuidv7 } from "uuidv7";
import { beforeEach, describe, expect, it } from "vitest";
import { label } from "./schema";
import { testDb, testSql, truncateTestDatabase } from "./test-database";

beforeEach(async () => {
  await truncateTestDatabase();
});

function labelValues(overrides: Partial<typeof label.$inferInsert> = {}) {
  const now = new Date();
  return {
    name: "Bug",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("label.name CHECK bound (FR-006, FR-007, research A-6)", () => {
  it("accepts a name at exactly 200 characters", async () => {
    await expect(testDb.insert(label).values(labelValues({ name: "a".repeat(200) }))).resolves.toBeDefined();
  });

  it("rejects a name over 200 characters", async () => {
    await expect(testDb.insert(label).values(labelValues({ name: "a".repeat(201) }))).rejects.toThrow();
  });
});

describe("label.name NOT NULL (FR-006)", () => {
  it("rejects a null name", async () => {
    const now = new Date().toISOString();
    await expect(
      testSql`INSERT INTO label ${testSql({ id: uuidv7(), name: null, created_at: now, updated_at: now })}`,
    ).rejects.toMatchObject({ code: "23502" });
  });
});

describe("label.name uniqueness is case-insensitive (FR-006, FR-007, OT-INV-016, research A-5, E-1)", () => {
  it("refuses a second label named identically except for case", async () => {
    await testDb.insert(label).values(labelValues({ name: "Bug" }));

    await expect(testDb.insert(label).values(labelValues({ name: "BUG" }))).rejects.toThrow();
  });

  it("allows a genuinely different name", async () => {
    await testDb.insert(label).values(labelValues({ name: "Bug" }));

    await expect(testDb.insert(label).values(labelValues({ name: "Feature" }))).resolves.toBeDefined();
  });

  it("under two concurrent connections racing the same case-folded name, exactly one insert succeeds", async () => {
    const name = `Bug-${crypto.randomUUID()}`;

    const results = await Promise.allSettled([
      testDb.insert(label).values(labelValues({ name })),
      testDb.insert(label).values(labelValues({ name: name.toUpperCase() })),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
  });
});