import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { truncateAllTablesStatement } from "./tables";

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

export async function truncateTestDatabase(): Promise<void> {
  await client.unsafe(truncateAllTablesStatement());
}