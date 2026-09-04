import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

function requireTestDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error("TEST_DATABASE_URL is not set");
  }
  return url;
}

const client = postgres(requireTestDatabaseUrl());

export const testSql = client;

export const testDb = drizzle(client, { schema });

const TRUNCATED_TABLES = [
  "auth_attempt",
  "reset_token",
  "session",
  "credential",
  "invite",
  "comment",
  "activity",
  "issue",
  "issue_label",
  "label",
  "issue_counter",
  "board_column",
  "project_member",
  "project",
  "user",
] as const;

export async function truncateTestDatabase(): Promise<void> {
  const tables = TRUNCATED_TABLES.map((table) => `"${table}"`).join(", ");
  await client.unsafe(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`);
}