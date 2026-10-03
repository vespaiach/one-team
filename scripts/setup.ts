import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { readSettings } from "../src/server/config.ts";
import { connect } from "../src/server/db.ts";
import { createFirstAdmin } from "../src/server/members.ts";

if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

try {
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      name: { type: "string" },
      username: { type: "string" },
    },
  });
  const db = connect(readSettings().databaseUrl);
  try {
    const result = await createFirstAdmin(db, {
      email: values.email ?? "",
      fullName: values.name ?? "",
      username: values.username ?? "",
    });
    if (result.ok) {
      process.stdout.write(`Created admin ${result.member.username}\n`);
    } else if ("fields" in result) {
      for (const [field, message] of Object.entries(result.fields)) {
        process.stderr.write(`${field}: ${message}\n`);
      }
      process.exitCode = 1;
    } else {
      process.stderr.write(`${result.error}\n`);
      process.exitCode = 1;
    }
  } finally {
    await db.$client.end();
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}