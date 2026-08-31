import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { session, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { issueSession } from "@/features/auth/server/sessions";
import { parseAdminDeactivateArgs, runAdminDeactivate, runAdminDeactivateCli } from "./admin-deactivate";

async function seedUser(overrides: Partial<typeof user.$inferInsert> = {}) {
  const now = new Date();
  const [row] = await testDb
    .insert(user)
    .values({
      firstName: "First",
      lastName: "Last",
      email: "target@example.com",
      role: "member",
      createdAt: now,
      updatedAt: now,
      ...overrides,
    })
    .returning();
  if (!row) {
    throw new Error("seedUser produced no row");
  }
  return row;
}

async function sessionCountFor(userId: string): Promise<number> {
  const rows = await testDb.select().from(session).where(eq(session.userId, userId));
  return rows.length;
}

beforeEach(async () => {
  await truncateTestDatabase();
});

describe("runAdminDeactivate (FR-054, FR-057, FR-078)", () => {
  it("sets deactivated_at and deletes every session row for the user, retaining the row", async () => {
    const target = await seedUser({ email: "active@example.com" });
    await issueSession({ userId: target.id, ipAddress: "127.0.0.1", userAgent: "test-agent" });
    await issueSession({ userId: target.id, ipAddress: "127.0.0.2", userAgent: "test-agent-2" });
    expect(await sessionCountFor(target.id)).toBe(2);

    const outcome = await runAdminDeactivate("active@example.com");

    expect(outcome).toEqual({ status: "deactivated" });

    const [row] = await testDb.select().from(user).where(eq(user.id, target.id));
    expect(row).toBeDefined();
    expect(row?.deactivatedAt).not.toBeNull();
    expect(await sessionCountFor(target.id)).toBe(0);
  });

  it("folds address case before the lookup", async () => {
    await seedUser({ email: "casefold@example.com" });

    const outcome = await runAdminDeactivate("CaseFold@Example.com");

    expect(outcome).toEqual({ status: "deactivated" });
  });

  it("refuses an address with no account, writing nothing and naming the address", async () => {
    const outcome = await runAdminDeactivate("nobody@example.com");

    expect(outcome).toEqual({ status: "unknown_address", email: "nobody@example.com" });
  });

  it("refuses to deactivate the only active admin, applying nothing", async () => {
    const admin = await seedUser({ email: "sole-admin@example.com", role: "admin" });

    const outcome = await runAdminDeactivate("sole-admin@example.com");

    expect(outcome).toEqual({ status: "last_admin" });

    const [row] = await testDb.select().from(user).where(eq(user.id, admin.id));
    expect(row?.deactivatedAt).toBeNull();
  });

  it("deactivates one of two admins without refusal", async () => {
    await seedUser({ email: "admin-a@example.com", role: "admin" });
    const adminB = await seedUser({ email: "admin-b@example.com", role: "admin" });

    const outcome = await runAdminDeactivate("admin-b@example.com");

    expect(outcome).toEqual({ status: "deactivated" });
    const [row] = await testDb.select().from(user).where(eq(user.id, adminB.id));
    expect(row?.deactivatedAt).not.toBeNull();
  });
});

describe("parseAdminDeactivateArgs (FR-075)", () => {
  it("accepts the required flag", () => {
    const result = parseAdminDeactivateArgs(["--email=Ada@Example.com"]);
    expect(result).toEqual({ ok: true, args: { email: "ada@example.com" } });
  });

  it("is a usage error when the flag is missing", () => {
    expect(parseAdminDeactivateArgs([]).ok).toBe(false);
  });

  it("is a usage error when the address is malformed", () => {
    expect(parseAdminDeactivateArgs(["--email=not-an-address"]).ok).toBe(false);
  });

  it("is a usage error on an unrecognised flag", () => {
    expect(parseAdminDeactivateArgs(["--email=ada@example.com", "--force"]).ok).toBe(false);
  });
});

function collectingStream() {
  const chunks: string[] = [];
  return {
    write(text: string) {
      chunks.push(text);
    },
    text: () => chunks.join(""),
  };
}

describe("runAdminDeactivateCli exit statuses (FR-074)", () => {
  it("exits 0 with one line on stdout on success", async () => {
    await seedUser({ email: "cli-success@example.com" });
    const stdout = collectingStream();
    const stderr = collectingStream();

    const code = await runAdminDeactivateCli(["--email=cli-success@example.com"], { stdout, stderr });

    expect(code).toBe(0);
    expect(stdout.text().split("\n").filter(Boolean)).toHaveLength(1);
  });

  it("exits 1 with one line on stderr naming the address on an unknown address", async () => {
    const stdout = collectingStream();
    const stderr = collectingStream();

    const code = await runAdminDeactivateCli(["--email=missing@example.com"], { stdout, stderr });

    expect(code).toBe(1);
    expect(stderr.text()).toContain("missing@example.com");
    expect(stderr.text().split("\n").filter(Boolean)).toHaveLength(1);
  });

  it("exits 1 with one line on stderr when it is the last active admin", async () => {
    await seedUser({ email: "only-admin@example.com", role: "admin" });
    const stdout = collectingStream();
    const stderr = collectingStream();

    const code = await runAdminDeactivateCli(["--email=only-admin@example.com"], { stdout, stderr });

    expect(code).toBe(1);
    expect(stderr.text().split("\n").filter(Boolean)).toHaveLength(1);
  });

  it("exits 2 on a usage error, writing nothing", async () => {
    const stdout = collectingStream();
    const stderr = collectingStream();

    const code = await runAdminDeactivateCli([], { stdout, stderr });

    expect(code).toBe(2);
    expect(stderr.text().split("\n").filter(Boolean)).toHaveLength(1);
  });
});