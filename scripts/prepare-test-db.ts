import { existsSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { applyMigrations } from "../src/server/migrations.ts";

const localHosts = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

function databaseIdentity(url: string): string {
  const parsed = new URL(url);
  const host = parsed.hostname.toLowerCase();
  const normalizedHost = localHosts.has(host) ? "localhost" : host;
  const port = parsed.port || "5432";
  const name = decodeURIComponent(parsed.pathname.slice(1));
  return `${normalizedHost}:${port}/${name}`;
}

export default async function prepareTestDatabase(): Promise<void> {
  if (existsSync(".env.local")) {
    process.loadEnvFile(".env.local");
  }
  const databaseUrl = process.env.DATABASE_URL;
  const testDatabaseUrl = process.env.TEST_DATABASE_URL;
  if (!testDatabaseUrl) {
    throw new Error("Missing setting: TEST_DATABASE_URL");
  }
  if (databaseUrl && databaseIdentity(databaseUrl) === databaseIdentity(testDatabaseUrl)) {
    throw new Error("TEST_DATABASE_URL must name a different database from DATABASE_URL");
  }
  const sql = postgres(testDatabaseUrl);
  try {
    await sql`drop schema if exists public cascade`;
    await sql`create schema public`;
    await applyMigrations(sql, path.resolve("migrations"));
  } finally {
    await sql.end();
  }
}