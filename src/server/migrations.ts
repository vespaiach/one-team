import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Sql } from "postgres";

async function listSqlFiles(folder: string): Promise<string[]> {
  try {
    const entries = await readdir(folder);
    return entries.filter((name) => name.endsWith(".sql")).sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export async function applyMigrations(sql: Sql, folder: string): Promise<string[]> {
  await sql`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`;
  const files = await listSqlFiles(folder);
  const rows = await sql<{ name: string }[]>`select name from schema_migrations`;
  const applied = new Set(rows.map((row) => row.name));
  const newlyApplied: string[] = [];
  for (const name of files) {
    if (applied.has(name)) {
      continue;
    }
    const text = await readFile(path.join(folder, name), "utf8");
    try {
      await sql.begin(async (tx) => {
        await tx.unsafe(text);
        await tx`insert into schema_migrations (name) values (${name})`;
      });
    } catch (error) {
      throw new Error(`Migration failed: ${name}`, { cause: error });
    }
    newlyApplied.push(name);
  }
  return newlyApplied;
}