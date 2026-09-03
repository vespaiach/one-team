import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { label } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import type { Actor } from "@/features/auth/server/actor";
import { updateLabel } from "./update-label";

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

describe("updateLabel — authorization (FR-009)", () => {
  it("refuses a non-admin, leaving the row untouched", async () => {
    const existing = await insertLabel({ name: "Bug" });

    const result = await updateLabel({ actor: actor({ role: "member" }), id: existing.id, name: "Renamed" });

    expect(result).toEqual({ ok: false, error: "forbidden" });
    const [row] = await testDb.select().from(label).where(eq(label.id, existing.id));
    expect(row?.name).toBe("Bug");
  });
});

describe("updateLabel — not found", () => {
  it("returns not_found for a missing id", async () => {
    const result = await updateLabel({ actor: actor(), id: crypto.randomUUID(), name: "Renamed" });
    expect(result).toEqual({ ok: false, error: "not_found" });
  });
});

describe("updateLabel — self-rename is not a clash (FR-010)", () => {
  it("saves successfully when renaming a label to its own current name", async () => {
    const existing = await insertLabel({ name: "Bug" });

    const result = await updateLabel({ actor: actor(), id: existing.id, name: "Bug" });

    expect(result.ok).toBe(true);
  });
});

describe("updateLabel — clash names the other label's holder (FR-007, FR-010)", () => {
  it("refuses a rename to another label's name, case-insensitively, naming that label", async () => {
    const toRename = await insertLabel({ name: "Bug" });
    const other = await insertLabel({ name: "Feature" });

    const result = await updateLabel({ actor: actor(), id: toRename.id, name: "FEATURE" });

    expect(result).toEqual({
      ok: false,
      error: "duplicate_name",
      holder: { id: other.id, name: "Feature" },
    });
    const [row] = await testDb.select().from(label).where(eq(label.id, toRename.id));
    expect(row?.name).toBe("Bug");
  });
});

describe("updateLabel — writes through touched() (FR-010)", () => {
  it("changes the label row's updated_at and no other row", async () => {
    const existing = await insertLabel({ name: "Bug", updatedAt: new Date("2020-01-01T00:00:00Z") });
    const other = await insertLabel({ name: "Feature", updatedAt: new Date("2020-01-01T00:00:00Z") });

    const result = await updateLabel({ actor: actor(), id: existing.id, name: "Renamed" });

    expect(result.ok).toBe(true);
    const [updatedRow] = await testDb.select().from(label).where(eq(label.id, existing.id));
    expect(updatedRow?.name).toBe("Renamed");
    expect(updatedRow?.updatedAt.getTime()).toBeGreaterThan(new Date("2020-01-01T00:00:00Z").getTime());

    const [otherRow] = await testDb.select().from(label).where(eq(label.id, other.id));
    expect(otherRow?.name).toBe("Feature");
    expect(otherRow?.updatedAt.toISOString()).toBe("2020-01-01T00:00:00.000Z");
  });
});