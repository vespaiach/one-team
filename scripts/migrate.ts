import { existsSync } from "node:fs";
import path from "node:path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { readSettings } from "../src/server/config.ts";
import { connect } from "../src/server/db.ts";

if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

try {
  const db = connect(readSettings().databaseUrl);
  try {
    await migrate(db, { migrationsFolder: path.resolve("migrations") });
    process.stdout.write("Migrations applied\n");
  } finally {
    await db.$client.end();
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  const cause = error instanceof Error && error.cause instanceof Error ? `: ${error.cause.message}` : "";
  process.stderr.write(`${message}${cause}\n`);
  process.exitCode = 1;
}