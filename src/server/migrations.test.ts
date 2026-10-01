import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import postgres from "postgres";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyMigrations } from "./migrations.ts";

function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error("Missing setting: TEST_DATABASE_URL");
  }
  return url;
}

const sql = postgres(testDatabaseUrl(), { onnotice: () => {} });
let folder: string;

async function writeMigrations(files: Record<string, string>): Promise<void> {
  for (const [name, text] of Object.entries(files)) {
    await writeFile(path.join(folder, name), text);
  }
}

async function recordedNames(): Promise<string[]> {
  const rows = await sql<{ name: string }[]>`select name from schema_migrations order by name`;
  return rows.map((row) => row.name);
}

async function tableExists(name: string): Promise<boolean> {
  const [row] = await sql<{ found: string | null }[]>`select to_regclass(${`public.${name}`}) as found`;
  return row.found !== null;
}

beforeEach(async () => {
  await sql`drop schema if exists public cascade`;
  await sql`create schema public`;
  folder = await mkdtemp(path.join(tmpdir(), "migrations-"));
});

afterEach(async () => {
  await rm(folder, { recursive: true, force: true });
});

afterAll(async () => {
  await sql.end();
});

describe("applyMigrations", () => {
  it("applies files in name order and records each one", async () => {
    await writeMigrations({
      "0002_second.sql": "insert into steps (name) values ('second');",
      "0001_first.sql":
        "create table steps (id serial primary key, name text not null); insert into steps (name) values ('first');",
      "0003_third.sql": "insert into steps (name) values ('third');",
    });

    const applied = await applyMigrations(sql, folder);

    expect(applied).toEqual(["0001_first.sql", "0002_second.sql", "0003_third.sql"]);
    const steps = await sql<{ name: string }[]>`select name from steps order by id`;
    expect(steps.map((step) => step.name)).toEqual(["first", "second", "third"]);
    expect(await recordedNames()).toEqual(["0001_first.sql", "0002_second.sql", "0003_third.sql"]);
  });

  it("applies nothing on a second run", async () => {
    await writeMigrations({
      "0001_first.sql": "create table steps (id serial primary key, name text not null);",
      "0002_second.sql": "insert into steps (name) values ('second');",
    });
    await applyMigrations(sql, folder);

    const applied = await applyMigrations(sql, folder);

    expect(applied).toEqual([]);
    const [{ count }] = await sql<{ count: number }[]>`select count(*)::int as count from steps`;
    expect(count).toBe(1);
    expect(await recordedNames()).toEqual(["0001_first.sql", "0002_second.sql"]);
  });

  it("stops at a failing file, keeps earlier files and names the failing one", async () => {
    await writeMigrations({
      "0001_first.sql": "create table first_table (id int);",
      "0002_broken.sql": "create table broken_table (id int); select * from missing_table;",
      "0003_third.sql": "create table third_table (id int);",
    });

    await expect(applyMigrations(sql, folder)).rejects.toThrow("0002_broken.sql");

    expect(await tableExists("first_table")).toBe(true);
    expect(await tableExists("broken_table")).toBe(false);
    expect(await tableExists("third_table")).toBe(false);
    expect(await recordedNames()).toEqual(["0001_first.sql"]);
  });

  it("applies nothing from an empty folder", async () => {
    const applied = await applyMigrations(sql, folder);

    expect(applied).toEqual([]);
    expect(await recordedNames()).toEqual([]);
  });

  it("applies nothing from a missing folder", async () => {
    const applied = await applyMigrations(sql, path.join(folder, "missing"));

    expect(applied).toEqual([]);
    expect(await recordedNames()).toEqual([]);
  });
});