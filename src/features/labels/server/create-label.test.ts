import { beforeEach, describe, expect, it } from "vitest";
import { label } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import type { Actor } from "@/features/auth/server/actor";
import { createLabel } from "./create-label";

beforeEach(async () => {
  await truncateTestDatabase();
});

function actor(overrides: Partial<Actor> = {}): Actor {
  return {
    id: crypto.randomUUID(),
    role: "admin",
    firstName: "Ada",
    lastName: "Lovelace",
    avatarUrl: null,
    mustChangePassword: false,
    ...overrides,
  };
}

async function insertLabel(overrides: Partial<typeof label.$inferInsert> = {}) {
  const now = new Date();
  const [row] = await testDb
    .insert(label)
    .values({
      name: `Bug-${crypto.randomUUID()}`,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    })
    .returning();
  if (!row) {
    throw new Error("insertLabel produced no row");
  }
  return row;
}

describe("createLabel — authorization (FR-001)", () => {
  it("refuses a non-admin", async () => {
    const result = await createLabel({ actor: actor({ role: "member" }), name: "Bug" });

    expect(result).toEqual({ ok: false, error: "forbidden" });
    const rows = await testDb.select().from(label);
    expect(rows).toHaveLength(0);
  });
});

describe("createLabel — validation (FR-006, FR-007)", () => {
  it("creates a label from a trimmed, non-empty, <= 200 character name", async () => {
    const result = await createLabel({ actor: actor(), name: "  Bug  " });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.label).toEqual({ id: result.label.id, name: "Bug", issueCount: 0 });
  });

  it("accepts a name at exactly 200 characters", async () => {
    const result = await createLabel({ actor: actor(), name: "a".repeat(200) });
    expect(result.ok).toBe(true);
  });

  it("refuses an empty name after trimming", async () => {
    const result = await createLabel({ actor: actor(), name: "   " });
    expect(result).toEqual({ ok: false, error: "invalid_name" });
  });

  it("refuses a name over 200 characters", async () => {
    const result = await createLabel({ actor: actor(), name: "a".repeat(201) });
    expect(result).toEqual({ ok: false, error: "invalid_name" });
  });
});

describe("createLabel — case-insensitive clash (FR-007, FR-008)", () => {
  it("refuses a name matching an existing label case-insensitively, naming the holder", async () => {
    const existing = await insertLabel({ name: "Bug" });

    const result = await createLabel({ actor: actor(), name: "BUG" });

    expect(result).toEqual({
      ok: false,
      error: "duplicate_name",
      holder: { id: existing.id, name: "Bug" },
    });
  });

  it("never applies a silent suffix to work around a clash", async () => {
    await insertLabel({ name: "Bug" });

    await createLabel({ actor: actor(), name: "Bug" });

    const rows = await testDb.select({ name: label.name }).from(label);
    expect(rows.map((row) => row.name)).toEqual(["Bug"]);
  });
});

describe("createLabel — the unique index enforces the race, not the pre-check (research C-3)", () => {
  it("under two admins creating the same name concurrently, exactly one succeeds", async () => {
    const name = `Bug-${crypto.randomUUID()}`;

    const [first, second] = await Promise.all([
      createLabel({ actor: actor(), name }),
      createLabel({ actor: actor(), name: name.toUpperCase() }),
    ]);

    const results = [first, second];
    const created = results.filter((result) => result.ok);
    const duplicates = results.filter((result) => !result.ok && result.error === "duplicate_name");

    expect(created).toHaveLength(1);
    expect(duplicates).toHaveLength(1);

    const rows = await testDb.select().from(label);
    expect(rows).toHaveLength(1);
  });
});