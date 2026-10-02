import postgres from "postgres";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createFirstAdmin, findActiveMemberByEmail } from "./members.ts";

function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error("Missing setting: TEST_DATABASE_URL");
  }
  return url;
}

const sql = postgres(testDatabaseUrl(), { onnotice: () => {} });

type MemberRow = {
  id: string;
  email: string;
  full_name: string;
  username: string;
  role: string;
  active: boolean;
};

const validInput = {
  email: "owner@acme.com",
  fullName: "Owner Name",
  username: "owner",
};

async function emptyMembers(): Promise<void> {
  await sql`delete from sessions`;
  await sql`delete from magic_links`;
  await sql`delete from sign_in_requests`;
  await sql`delete from sign_in_attempts`;
  await sql`delete from members`;
}

async function memberRows(): Promise<MemberRow[]> {
  return sql<MemberRow[]>`
    select id::text as id, email, full_name, username, role, active from members order by id
  `;
}

async function insertMember(values: {
  email: string;
  fullName: string;
  username: string;
  role?: "admin" | "member";
  active?: boolean;
}): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    insert into members (email, full_name, username, role, active)
    values (${values.email}, ${values.fullName}, ${values.username}, ${values.role ?? "member"}, ${values.active ?? true})
    returning id::text as id
  `;
  return row.id;
}

beforeEach(async () => {
  await emptyMembers();
});

afterAll(async () => {
  await sql.end();
});

describe("createFirstAdmin", () => {
  it("OPS-001.1 creates the first admin on an empty database", async () => {
    const result = await createFirstAdmin(sql, {
      email: "  owner@acme.com  ",
      fullName: "  Owner Name  ",
      username: "Owner",
    });

    const rows = await memberRows();
    expect(rows).toEqual([
      {
        id: expect.any(String),
        email: "owner@acme.com",
        full_name: "Owner Name",
        username: "owner",
        role: "admin",
        active: true,
      },
    ]);
    expect(result).toEqual({
      ok: true,
      member: { id: expect.anything(), fullName: "Owner Name", username: "owner", role: "admin" },
    });
    if (result.ok) {
      expect(String(result.member.id)).toBe(rows[0].id);
    }
  });

  it("OPS-001.2 refuses with Setup already done when a member exists", async () => {
    await insertMember({ email: "existing@acme.com", fullName: "Existing Member", username: "existing" });
    const before = await memberRows();

    const result = await createFirstAdmin(sql, validInput);

    expect(result).toEqual({ ok: false, error: "Setup already done" });
    expect(await memberRows()).toEqual(before);
  });

  it("refuses invalid input with its field errors even when members exist", async () => {
    await insertMember({ email: "existing@acme.com", fullName: "Existing Member", username: "existing" });
    const before = await memberRows();

    const result = await createFirstAdmin(sql, { ...validInput, username: "a" });

    expect(result).toEqual({
      ok: false,
      fields: { username: "2 to 20 lowercase letters, digits or hyphens" },
    });
    expect(await memberRows()).toEqual(before);
  });

  it("refuses a blank full name with Name required", async () => {
    const result = await createFirstAdmin(sql, { ...validInput, fullName: "" });

    expect(result).toEqual({ ok: false, fields: { "full name": "Name required" } });
    expect(await memberRows()).toEqual([]);
  });

  it("refuses a whitespace-only full name with Name required", async () => {
    const result = await createFirstAdmin(sql, { ...validInput, fullName: "   " });

    expect(result).toEqual({ ok: false, fields: { "full name": "Name required" } });
    expect(await memberRows()).toEqual([]);
  });

  it("refuses a full name over 60 characters after trimming with Too long (max 60)", async () => {
    const result = await createFirstAdmin(sql, { ...validInput, fullName: `  ${"a".repeat(61)}  ` });

    expect(result).toEqual({ ok: false, fields: { "full name": "Too long (max 60)" } });
    expect(await memberRows()).toEqual([]);
  });

  it("accepts a 60-character full name", async () => {
    const fullName = "b".repeat(60);

    const result = await createFirstAdmin(sql, { ...validInput, fullName });

    expect(result.ok).toBe(true);
    expect((await memberRows()).map((row) => row.full_name)).toEqual([fullName]);
  });

  it("accepts a 60-character full name with spaces around it and stores it trimmed", async () => {
    const fullName = "c".repeat(60);

    const result = await createFirstAdmin(sql, { ...validInput, fullName: `   ${fullName}   ` });

    expect(result.ok).toBe(true);
    expect((await memberRows()).map((row) => row.full_name)).toEqual([fullName]);
  });

  it("lowercases the username before checking it", async () => {
    const result = await createFirstAdmin(sql, { ...validInput, username: "OWNER-01" });

    expect(result.ok).toBe(true);
    expect((await memberRows()).map((row) => row.username)).toEqual(["owner-01"]);
  });

  it("accepts usernames of 2 and 20 characters", async () => {
    expect((await createFirstAdmin(sql, { ...validInput, username: "ab" })).ok).toBe(true);
    await emptyMembers();
    expect((await createFirstAdmin(sql, { ...validInput, username: "a".repeat(20) })).ok).toBe(true);
  });

  it.each([
    ["empty", ""],
    ["one character", "a"],
    ["21 characters", "a".repeat(21)],
    ["a space", "own er"],
    ["an underscore", "own_er"],
    ["a dot", "own.er"],
    ["a non-ASCII letter", "ownér"],
    ["surrounding spaces", " owner "],
  ])("refuses a username with %s", async (_label, username) => {
    const result = await createFirstAdmin(sql, { ...validInput, username });

    expect(result).toEqual({
      ok: false,
      fields: { username: "2 to 20 lowercase letters, digits or hyphens" },
    });
    expect(await memberRows()).toEqual([]);
  });

  it.each([
    ["empty", ""],
    ["no at sign", "nope"],
    ["no domain", "a@"],
    ["no local part", "@b.com"],
  ])("refuses an invalid email (%s) with Enter a valid email address.", async (_label, email) => {
    const result = await createFirstAdmin(sql, { ...validInput, email });

    expect(result).toEqual({ ok: false, fields: { email: "Enter a valid email address." } });
    expect(await memberRows()).toEqual([]);
  });

  it("reports every invalid field at once", async () => {
    const result = await createFirstAdmin(sql, { email: "nope", fullName: "   ", username: "a" });

    expect(result).toEqual({
      ok: false,
      fields: {
        "full name": "Name required",
        username: "2 to 20 lowercase letters, digits or hyphens",
        email: "Enter a valid email address.",
      },
    });
    expect(await memberRows()).toEqual([]);
  });

  it("creates exactly one admin when two runs start at the same time", async () => {
    const first = postgres(testDatabaseUrl(), { max: 1, onnotice: () => {} });
    const second = postgres(testDatabaseUrl(), { max: 1, onnotice: () => {} });
    try {
      const results = await Promise.all([
        createFirstAdmin(first, { email: "first@acme.com", fullName: "First Owner", username: "first" }),
        createFirstAdmin(second, { email: "second@acme.com", fullName: "Second Owner", username: "second" }),
      ]);

      expect(results.filter((result) => result.ok)).toHaveLength(1);
      expect(results.filter((result) => !result.ok)).toEqual([{ ok: false, error: "Setup already done" }]);
      const rows = await memberRows();
      expect(rows).toHaveLength(1);
      expect(rows[0].role).toBe("admin");
    } finally {
      await first.end();
      await second.end();
    }
  });
});

describe("findActiveMemberByEmail", () => {
  it("matches ignoring capitals and surrounding whitespace", async () => {
    const id = await insertMember({ email: "sam@acme.com", fullName: "Sam Lee", username: "sam-find" });

    const member = await findActiveMemberByEmail(sql, "  Sam@Acme.com  ");

    expect(member).toEqual({
      id: expect.anything(),
      fullName: "Sam Lee",
      username: "sam-find",
      role: "member",
    });
    expect(String(member?.id)).toBe(id);
  });

  it("matches a stored email that has capitals", async () => {
    await insertMember({ email: "Kim@Acme.com", fullName: "Kim Park", username: "kim-find", role: "admin" });

    const member = await findActiveMemberByEmail(sql, "kim@acme.com");

    expect(member).toEqual({
      id: expect.anything(),
      fullName: "Kim Park",
      username: "kim-find",
      role: "admin",
    });
  });

  it("returns null for an unknown email", async () => {
    expect(await findActiveMemberByEmail(sql, "nobody-find@acme.com")).toBeNull();
  });

  it("returns null for an inactive member", async () => {
    await insertMember({
      email: "gone-find@acme.com",
      fullName: "Gone Member",
      username: "gone-find",
      active: false,
    });

    expect(await findActiveMemberByEmail(sql, "gone-find@acme.com")).toBeNull();
  });
});