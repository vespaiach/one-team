import { existsSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { readSettings } from "../src/server/config.ts";
import { applyMigrations } from "../src/server/migrations.ts";

if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

try {
  const sql = postgres(readSettings().databaseUrl, { onnotice: () => {} });
  try {
    const applied = await applyMigrations(sql, path.resolve("migrations"));
    if (applied.length === 0) {
      process.stdout.write("Nothing pending\n");
    }
    for (const name of applied) {
      process.stdout.write(`Applied ${name}\n`);
    }
  } finally {
    await sql.end();
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  const cause = error instanceof Error && error.cause instanceof Error ? `: ${error.cause.message}` : "";
  process.stderr.write(`${message}${cause}\n`);
  process.exitCode = 1;
}
