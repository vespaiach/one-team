import postgres from "postgres";
import { readSettings } from "./config.ts";

let client: postgres.Sql | undefined;

export function db(): postgres.Sql {
  client ??= postgres(readSettings().databaseUrl);
  return client;
}