import { Readable, Writable } from "node:stream";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { credential, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { verifyPassword } from "@/features/auth/server/crypto";
import { parseAdminGrantArgs, promptHiddenPassword, runAdminGrant, runAdminGrantCli } from "./admin-grant";

const VALID_PASSWORD = "correct horse battery";

async function userByEmail(email: string) {
  const [row] = await testDb.select().from(user).where(eq(user.email, email));
  return row ?? null;
}

async function credentialFor(userId: string) {
  const [row] = await testDb.select().from(credential).where(eq(credential.userId, userId));
  return row ?? null;
}

beforeEach(async () => {
  await truncateTestDatabase();
});

describe("runAdminGrant (FR-051, FR-077)", () => {
  it("creates an admin for a fresh address with the password read at the prompt", async () => {
    const outcome = await runAdminGrant(
      { email: "fresh@example.com", firstName: "Ada", lastName: "Lovelace" },
      VALID_PASSWORD,
    );

    expect(outcome).toEqual({ status: "created" });

    const row = await userByEmail("fresh@example.com");
    expect(row?.role).toBe("admin");
    expect(row?.deactivatedAt).toBeNull();
    expect(row?.mustChangePassword).toBe(false);

    const cred = await credentialFor(row?.id ?? "");
    expect(await verifyPassword(cred?.passwordHash ?? "", VALID_PASSWORD)).toBe(true);
  });

  it("promotes an existing member, replacing the password and clearing deactivation and the flag", async () => {
    const now = new Date();
    const [member] = await testDb
      .insert(user)
      .values({
        firstName: "Grace",
        lastName: "Hopper",
        email: "member@example.com",
        role: "member",
        mustChangePassword: true,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    if (!member) throw new Error("seed failed");
    await testDb
      .insert(credential)
      .values({ userId: member.id, passwordHash: "old-hash", createdAt: now, updatedAt: now });

    const outcome = await runAdminGrant(
      { email: "member@example.com", firstName: "ignored", lastName: "ignored" },
      VALID_PASSWORD,
    );

    expect(outcome).toEqual({ status: "promoted" });

    const row = await userByEmail("member@example.com");
    expect(row?.role).toBe("admin");
    expect(row?.deactivatedAt).toBeNull();
    expect(row?.mustChangePassword).toBe(false);

    const cred = await credentialFor(member.id);
    expect(await verifyPassword(cred?.passwordHash ?? "", VALID_PASSWORD)).toBe(true);
  });

  it("reopens a deactivated account as an admin", async () => {
    const now = new Date();
    const [deactivated] = await testDb
      .insert(user)
      .values({
        firstName: "Closed",
        lastName: "Account",
        email: "closed@example.com",
        role: "member",
        deactivatedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    if (!deactivated) throw new Error("seed failed");

    const outcome = await runAdminGrant(
      { email: "closed@example.com", firstName: "ignored", lastName: "ignored" },
      VALID_PASSWORD,
    );

    expect(outcome).toEqual({ status: "reopened" });

    const row = await userByEmail("closed@example.com");
    expect(row?.role).toBe("admin");
    expect(row?.deactivatedAt).toBeNull();
  });

  it("replaces the password of an already-active admin without error, leaving role and deactivation alone", async () => {
    const now = new Date();
    const [admin] = await testDb
      .insert(user)
      .values({
        firstName: "Already",
        lastName: "Admin",
        email: "admin@example.com",
        role: "admin",
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    if (!admin) throw new Error("seed failed");
    await testDb
      .insert(credential)
      .values({ userId: admin.id, passwordHash: "old-hash", createdAt: now, updatedAt: now });

    const outcome = await runAdminGrant(
      { email: "admin@example.com", firstName: "ignored", lastName: "ignored" },
      VALID_PASSWORD,
    );

    expect(outcome).toEqual({ status: "password_replaced" });

    const row = await userByEmail("admin@example.com");
    expect(row?.role).toBe("admin");
    expect(row?.deactivatedAt).toBeNull();

    const cred = await credentialFor(admin.id);
    expect(await verifyPassword(cred?.passwordHash ?? "", VALID_PASSWORD)).toBe(true);
  });

  it("folds address case before any lookup", async () => {
    await runAdminGrant({ email: "Mixed@Example.com", firstName: "A", lastName: "B" }, VALID_PASSWORD);
    const again = await runAdminGrant(
      { email: "mixed@example.com", firstName: "ignored", lastName: "ignored" },
      VALID_PASSWORD,
    );

    expect(again.status).toBe("password_replaced");
    const rows = await testDb.select().from(user);
    expect(rows).toHaveLength(1);
  });
});

describe("runAdminGrant password policy (FR-053)", () => {
  it("refuses a password under twelve characters, writing nothing", async () => {
    const outcome = await runAdminGrant(
      { email: "short@example.com", firstName: "A", lastName: "B" },
      "short12345",
    );

    expect(outcome).toEqual({ status: "policy", failure: "too_short" });
    expect(await userByEmail("short@example.com")).toBeNull();
  });

  it("refuses a blocklisted password whatever its case, writing nothing", async () => {
    const outcome = await runAdminGrant(
      { email: "blocklisted@example.com", firstName: "A", lastName: "B" },
      "unbelievable",
    );

    expect(outcome).toEqual({ status: "policy", failure: "blocklisted" });
    expect(await userByEmail("blocklisted@example.com")).toBeNull();
  });
});

describe("parseAdminGrantArgs (FR-052, FR-075)", () => {
  it("accepts the three required flags", () => {
    const result = parseAdminGrantArgs([
      "--email=Ada@Example.com",
      "--first-name=Ada",
      "--last-name=Lovelace",
    ]);

    expect(result).toEqual({
      ok: true,
      args: { email: "ada@example.com", firstName: "Ada", lastName: "Lovelace" },
    });
  });

  it("is a usage error when a required flag is missing", () => {
    const result = parseAdminGrantArgs(["--email=ada@example.com", "--first-name=Ada"]);
    expect(result.ok).toBe(false);
  });

  it("is a usage error when the address is malformed", () => {
    const result = parseAdminGrantArgs([
      "--email=not-an-address",
      "--first-name=Ada",
      "--last-name=Lovelace",
    ]);
    expect(result.ok).toBe(false);
  });

  it("--password=... is an unrecognised flag, never accepted as the password", () => {
    const result = parseAdminGrantArgs([
      "--email=ada@example.com",
      "--first-name=Ada",
      "--last-name=Lovelace",
      "--password=hunter2hunter2",
    ]);
    expect(result.ok).toBe(false);
  });
});

describe("promptHiddenPassword (FR-076)", () => {
  it("refuses to prompt when the input stream is not an interactive terminal", async () => {
    const input = Object.assign(new Readable({ read() {} }), { isTTY: false });
    const output = new Writable({
      write(_chunk, _encoding, callback) {
        callback();
      },
    });

    await expect(promptHiddenPassword(input, output)).rejects.toThrow();
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

describe("runAdminGrantCli exit statuses (FR-074)", () => {
  it("exits 0 with one line on stdout on success", async () => {
    const stdout = collectingStream();
    const stderr = collectingStream();

    const code = await runAdminGrantCli(
      ["--email=cli-success@example.com", "--first-name=A", "--last-name=B"],
      { readPassword: () => Promise.resolve(VALID_PASSWORD), stdout, stderr },
    );

    expect(code).toBe(0);
    expect(stdout.text().split("\n").filter(Boolean)).toHaveLength(1);
    expect(await userByEmail("cli-success@example.com")).not.toBeNull();
  });

  it("exits 1 with one line on stderr on a non-compliant password, writing nothing", async () => {
    const stdout = collectingStream();
    const stderr = collectingStream();

    const code = await runAdminGrantCli(
      ["--email=cli-refused@example.com", "--first-name=A", "--last-name=B"],
      { readPassword: () => Promise.resolve("short12345"), stdout, stderr },
    );

    expect(code).toBe(1);
    expect(stderr.text().split("\n").filter(Boolean)).toHaveLength(1);
    expect(await userByEmail("cli-refused@example.com")).toBeNull();
  });

  it("exits 2 on a usage error without prompting or writing anything", async () => {
    const stdout = collectingStream();
    const stderr = collectingStream();
    let prompted = false;

    const code = await runAdminGrantCli(["--email=cli-usage@example.com", "--first-name=A"], {
      readPassword: () => {
        prompted = true;
        return Promise.resolve(VALID_PASSWORD);
      },
      stdout,
      stderr,
    });

    expect(code).toBe(2);
    expect(prompted).toBe(false);
    expect(stderr.text().split("\n").filter(Boolean)).toHaveLength(1);
    expect(await userByEmail("cli-usage@example.com")).toBeNull();
  });

  it("exits 1 without writing anything when the terminal cannot suppress echo", async () => {
    const stdout = collectingStream();
    const stderr = collectingStream();

    const code = await runAdminGrantCli(
      ["--email=cli-no-tty@example.com", "--first-name=A", "--last-name=B"],
      { readPassword: () => Promise.reject(new Error("cannot_suppress_echo")), stdout, stderr },
    );

    expect(code).toBe(1);
    expect(await userByEmail("cli-no-tty@example.com")).toBeNull();
  });
});