import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { readSettings } from "./config.ts";
import * as schema from "./schema.ts";

export type Database = PostgresJsDatabase<typeof schema> & { $client: postgres.Sql };
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type Executor = Database | Transaction;

export function connect(url: string): Database {
  return drizzle({ client: postgres(url, { onnotice: () => {} }), schema });
}

let client: Database | undefined;

export function db(): Database {
  client ??= connect(readSettings().databaseUrl);
  return client;
}