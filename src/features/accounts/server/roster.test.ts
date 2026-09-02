import { beforeEach, describe, expect, it } from "vitest";
import { invite, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { listOutstandingInvitations, loadRoster } from "./roster";

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

async function insertInvite(overrides: Partial<typeof invite.$inferInsert> & { invitedBy: string }) {
  const now = new Date();
  const [row] = await testDb
    .insert(invite)
    .values({
      email: `invitee-${crypto.randomUUID()}@example.com`,
      tokenDigest: crypto.randomUUID().replace(/-/g, "").repeat(2),
      expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
      ...overrides,
    })
    .returning();
  if (!row) {
    throw new Error("insertInvite produced no row");
  }
  return row;
}

describe("listOutstandingInvitations (FR-018, FR-015, FR-022)", () => {
  it("excludes a spent row", async () => {
    const admin = await insertUser({ role: "admin" });
    await insertInvite({ invitedBy: admin.id, acceptedAt: new Date() });
    const outstanding = await insertInvite({ invitedBy: admin.id });

    const rows = await listOutstandingInvitations();

    expect(rows.map((row) => row.id)).toEqual([outstanding.id]);
  });

  it("orders by created_at then id, both descending, so two renders agree", async () => {
    const admin = await insertUser({ role: "admin" });
    const now = new Date("2026-01-01T00:00:00.000Z");
    const older = await insertInvite({ invitedBy: admin.id, createdAt: now, updatedAt: now });
    const newer = await insertInvite({
      invitedBy: admin.id,
      createdAt: new Date(now.getTime() + 1000),
      updatedAt: new Date(now.getTime() + 1000),
    });

    const rows = await listOutstandingInvitations();

    expect(rows.map((row) => row.id)).toEqual([newer.id, older.id]);
  });

  it("computes isExpired against one supplied now", async () => {
    const admin = await insertUser({ role: "admin" });
    const now = new Date("2026-01-01T00:00:00.000Z");
    const expired = await insertInvite({
      invitedBy: admin.id,
      expiresAt: new Date(now.getTime() - 1000),
    });
    const live = await insertInvite({
      invitedBy: admin.id,
      expiresAt: new Date(now.getTime() + 1000),
    });

    const rows = await listOutstandingInvitations(now);

    const byId = new Map(rows.map((row) => [row.id, row]));
    expect(byId.get(expired.id)?.isExpired).toBe(true);
    expect(byId.get(live.id)?.isExpired).toBe(false);
  });

  it("carries invitedByName for a deactivated inviter", async () => {
    const admin = await insertUser({
      role: "admin",
      firstName: "Grace",
      lastName: "Hopper",
      deactivatedAt: new Date(),
    });
    const issued = await insertInvite({ invitedBy: admin.id });

    const rows = await listOutstandingInvitations();

    expect(rows.find((row) => row.id === issued.id)?.invitedByName).toBe("Grace Hopper");
  });

  it("never selects tokenDigest", async () => {
    const admin = await insertUser({ role: "admin" });
    await insertInvite({ invitedBy: admin.id });

    const rows = await listOutstandingInvitations();

    expect(rows[0]).not.toHaveProperty("tokenDigest");
  });
});

describe("loadRoster (FR-036…FR-041, FR-050)", () => {
  it("lists active accounts before closed", async () => {
    const closed = await insertUser({ firstName: "Aaron", lastName: "Aaronson", deactivatedAt: new Date() });
    const active = await insertUser({ firstName: "Zach", lastName: "Zachary" });

    const { rows } = await loadRoster();

    expect(rows.map((row) => row.id)).toEqual([active.id, closed.id]);
  });

  it("orders by display name under one fixed collation that does not follow the request locale", async () => {
    const accented = await insertUser({ firstName: "Åsa", lastName: "Utf8" });
    const ascii = await insertUser({ firstName: "Zach", lastName: "Ascii" });

    const { rows } = await loadRoster();

    expect(rows.map((row) => row.id)).toEqual([ascii.id, accented.id]);
  });

  it("breaks a display-name tie by the unique address", async () => {
    const first = await insertUser({ firstName: "Ada", lastName: "Lovelace", email: "a-ada@example.com" });
    const second = await insertUser({ firstName: "Ada", lastName: "Lovelace", email: "b-ada@example.com" });

    const { rows } = await loadRoster();

    expect(rows.map((row) => row.id)).toEqual([first.id, second.id]);
  });

  it("joins the display name with one space", async () => {
    await insertUser({ firstName: "Grace", lastName: "Hopper" });

    const { rows } = await loadRoster();

    expect(rows[0]?.displayName).toBe("Grace Hopper");
  });

  it("reads joinedAt from created_at and email through accountUser, never publicUser", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const created = await insertUser({ email: "ada@example.com", createdAt: now, updatedAt: now });

    const { rows } = await loadRoster();

    const row = rows.find((candidate) => candidate.id === created.id);
    expect(row?.joinedAt.getTime()).toBe(now.getTime());
    expect(row?.email).toBe("ada@example.com");
  });

  it("reports projectCount as literally 0", async () => {
    await insertUser();

    const { rows } = await loadRoster();

    expect(rows[0]?.projectCount).toBe(0);
  });

  it("returns activeAdminCount in the same read", async () => {
    await insertUser({ role: "admin" });
    await insertUser({ role: "admin", deactivatedAt: new Date() });
    await insertUser({ role: "member" });

    const { activeAdminCount } = await loadRoster();

    expect(activeAdminCount).toBe(1);
  });

  it("reports isActive false for a deactivated account and true otherwise", async () => {
    const active = await insertUser();
    const closed = await insertUser({ deactivatedAt: new Date() });

    const { rows } = await loadRoster();

    expect(rows.find((row) => row.id === active.id)?.isActive).toBe(true);
    expect(rows.find((row) => row.id === closed.id)?.isActive).toBe(false);
  });
});