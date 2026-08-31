import { and, eq, isNull } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { user } from "@/db/schema";
import { truncateTestDatabase } from "@/db/test-database";
import { LastAdminRefusal, withLastAdminGuard } from "./admin-guard";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function seedAdmin(email: string) {
  const now = new Date();
  const [row] = await db
    .insert(user)
    .values({
      firstName: "Admin",
      lastName: email,
      email,
      role: "admin",
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!row) {
    throw new Error("seedAdmin produced no row");
  }
  return row;
}

async function seedMember(email: string) {
  const now = new Date();
  const [row] = await db
    .insert(user)
    .values({
      firstName: "Member",
      lastName: email,
      email,
      role: "member",
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!row) {
    throw new Error("seedMember produced no row");
  }
  return row;
}

async function activeAdminCount(): Promise<number> {
  const rows = await db
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.role, "admin"), isNull(user.deactivatedAt)));
  return rows.length;
}

function deactivate(tx: Transaction, targetId: string) {
  return async () => {
    await tx.update(user).set({ deactivatedAt: new Date() }).where(eq(user.id, targetId));
  };
}

beforeEach(async () => {
  await truncateTestDatabase();
});

describe("withLastAdminGuard (FR-056, OT-INV-013)", () => {
  it("applies the change when another active admin remains", async () => {
    const admin = await seedAdmin("admin-a@example.com");
    await seedAdmin("admin-b@example.com");

    await db.transaction((tx) => withLastAdminGuard(tx, admin.id, deactivate(tx, admin.id)));

    expect(await activeAdminCount()).toBe(1);
  });

  it("refuses a change to the only active admin, applying nothing", async () => {
    const admin = await seedAdmin("only-admin@example.com");

    await expect(
      db.transaction((tx) => withLastAdminGuard(tx, admin.id, deactivate(tx, admin.id))),
    ).rejects.toThrow(LastAdminRefusal);

    expect(await activeAdminCount()).toBe(1);
    const [row] = await db.select().from(user).where(eq(user.id, admin.id));
    expect(row?.deactivatedAt).toBeNull();
  });

  it("does not refuse a change to a target who is not an active admin", async () => {
    await seedAdmin("sole-admin@example.com");
    const member = await seedMember("member@example.com");

    await db.transaction((tx) => withLastAdminGuard(tx, member.id, deactivate(tx, member.id)));

    expect(await activeAdminCount()).toBe(1);
    const [row] = await db.select().from(user).where(eq(user.id, member.id));
    expect(row?.deactivatedAt).not.toBeNull();
  });

  it("two concurrent deactivations for the sole active admin leave it active and refuse both", async () => {
    const admin = await seedAdmin("lonely-admin@example.com");

    const results = await Promise.allSettled([
      db.transaction((tx) => withLastAdminGuard(tx, admin.id, deactivate(tx, admin.id))),
      db.transaction((tx) => withLastAdminGuard(tx, admin.id, deactivate(tx, admin.id))),
    ]);

    expect(results.every((result) => result.status === "rejected")).toBe(true);
    expect(await activeAdminCount()).toBe(1);
  });

  it("locks the active-admin set so two concurrent deactivations of different admins cannot both succeed", async () => {
    const adminA = await seedAdmin("race-a@example.com");
    const adminB = await seedAdmin("race-b@example.com");

    const results = await Promise.allSettled([
      db.transaction((tx) => withLastAdminGuard(tx, adminA.id, deactivate(tx, adminA.id))),
      db.transaction((tx) => withLastAdminGuard(tx, adminB.id, deactivate(tx, adminB.id))),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    expect(fulfilled).toHaveLength(1);
    expect(await activeAdminCount()).toBe(1);
  });
});