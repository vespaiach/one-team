import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { credential, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { type BootstrapEnv, bootstrap, seedFirstAdmin } from "./bootstrap";

const VALID_ADMIN_EMAIL = "admin@example.com";
const VALID_ADMIN_PASSWORD = "correct horse battery";

function validEnv(overrides: Partial<BootstrapEnv> = {}): BootstrapEnv {
  return {
    appUrl: "https://example.com",
    databaseUrl: process.env.DATABASE_URL,
    adminEmail: VALID_ADMIN_EMAIL,
    adminPassword: VALID_ADMIN_PASSWORD,
    ...overrides,
  };
}

async function allUsers() {
  return testDb.select().from(user);
}

let logLines: string[] = [];

beforeEach(async () => {
  await truncateTestDatabase();
  logLines = [];
  vi.spyOn(console, "error").mockImplementation((line: unknown) => {
    logLines.push(String(line));
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("bootstrap seeding (FR-045, FR-047, FR-048, SC-002)", () => {
  it("a first start on an empty database creates exactly one admin carrying must_change_password", async () => {
    await bootstrap(validEnv());

    const rows = await allUsers();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.role).toBe("admin");
    expect(rows[0]?.mustChangePassword).toBe(true);
    expect(rows[0]?.email).toBe(VALID_ADMIN_EMAIL);

    const credentialRows = await testDb
      .select()
      .from(credential)
      .where(eq(credential.userId, rows[0]?.id ?? ""));
    expect(credentialRows).toHaveLength(1);
  });

  it("a second start creates nothing whatever the environment says", async () => {
    await bootstrap(validEnv());
    await bootstrap(
      validEnv({ adminEmail: "someone-else@example.com", adminPassword: "another compliant password" }),
    );

    const rows = await allUsers();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.email).toBe(VALID_ADMIN_EMAIL);
  });
});

describe("bootstrap refusals (FR-046, FR-058, FR-072, FR-073, OT-SEC-019)", () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`process.exit(${code})`);
    }) as never);
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  it("a short ADMIN_PASSWORD names too_short on stderr, writes nothing, and exits non-zero", async () => {
    await expect(bootstrap(validEnv({ adminPassword: "short12345" }))).rejects.toThrow("process.exit(1)");

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(stderrSpy.mock.calls.flat().join("\n")).toContain("too_short");
    expect(await allUsers()).toHaveLength(0);
    expect(logLines.some((line) => line.includes("refused_first_run_seed"))).toBe(true);
  });

  it("a blocklisted ADMIN_PASSWORD names blocklisted on stderr, writes nothing, and exits non-zero", async () => {
    await expect(bootstrap(validEnv({ adminPassword: "unbelievable" }))).rejects.toThrow("process.exit(1)");

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(stderrSpy.mock.calls.flat().join("\n")).toContain("blocklisted");
    expect(await allUsers()).toHaveLength(0);
  });

  it("an invalid ADMIN_EMAIL ends the process the same way, writing nothing", async () => {
    await expect(bootstrap(validEnv({ adminEmail: "not-an-email" }))).rejects.toThrow("process.exit(1)");

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(stderrSpy.mock.calls.flat().join("\n")).toContain("invalid_admin_email");
    expect(await allUsers()).toHaveLength(0);
  });

  it("an unreachable database ends the process the same way", async () => {
    await expect(
      bootstrap(validEnv({ databaseUrl: "postgres://127.0.0.1:1/does-not-exist" })),
    ).rejects.toThrow("process.exit(1)");

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(stderrSpy.mock.calls.flat().join("\n")).toContain("database_unreachable");
  });

  it("a missing APP_URL ends the process the same way", async () => {
    await expect(bootstrap(validEnv({ appUrl: undefined }))).rejects.toThrow("process.exit(1)");

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(stderrSpy.mock.calls.flat().join("\n")).toContain("missing_app_url");
    expect(await allUsers()).toHaveLength(0);
  });

  it("an absent ADMIN_EMAIL skips seeding and serves normally", async () => {
    await expect(bootstrap(validEnv({ adminEmail: undefined }))).resolves.toBeUndefined();

    expect(exitSpy).not.toHaveBeenCalled();
    expect(await allUsers()).toHaveLength(0);
  });
});

describe("bootstrap concurrency (FR-047, FR-059)", () => {
  it("two processes seeding one empty database concurrently leave one admin, the loser reading it as already seeded", async () => {
    const [first, second] = await Promise.all([
      seedFirstAdmin({ adminEmail: VALID_ADMIN_EMAIL, adminPassword: VALID_ADMIN_PASSWORD }),
      seedFirstAdmin({ adminEmail: VALID_ADMIN_EMAIL, adminPassword: VALID_ADMIN_PASSWORD }),
    ]);

    expect([first, second].sort()).toEqual(["already_seeded", "seeded"]);
    expect(await allUsers()).toHaveLength(1);
  });
});

describe("must_change_password is set only by seeding (FR-048, FR-050)", () => {
  it("defaults to false for a user row created any other way", async () => {
    const now = new Date();
    const [row] = await testDb
      .insert(user)
      .values({
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@example.com",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    expect(row?.mustChangePassword).toBe(false);
  });

  it("is true only on the row seeding creates", async () => {
    await bootstrap(validEnv());

    const rows = await allUsers();
    expect(rows[0]?.mustChangePassword).toBe(true);
  });
});