import { parseArgs } from "node:util";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

export type AdminDeactivateArgs = { email: string };
export type ArgsResult = { ok: true; args: AdminDeactivateArgs } | { ok: false; message: string };

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 200;

function foldEmail(value: string): string | null {
  if (value.length > MAX_EMAIL_LENGTH || !EMAIL_SHAPE.test(value)) {
    return null;
  }
  return value.toLowerCase();
}

export function parseAdminDeactivateArgs(argv: string[]): ArgsResult {
  let values: { email?: string };
  try {
    ({ values } = parseArgs({
      args: argv,
      options: { email: { type: "string" } },
      strict: true,
      allowPositionals: false,
    }));
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "invalid arguments" };
  }

  if (!values.email) {
    return { ok: false, message: "usage: admin:deactivate --email=<address>" };
  }

  const email = foldEmail(values.email);
  if (!email) {
    return { ok: false, message: "the email address is not valid" };
  }

  return { ok: true, args: { email } };
}

let dbModulePromise: ReturnType<typeof importDb> | null = null;

function importDb() {
  return import("../src/db/index.ts");
}

function loadDb() {
  dbModulePromise ??= importDb();
  return dbModulePromise;
}

export type DeactivateOutcome =
  | { status: "deactivated" }
  | { status: "unknown_address"; email: string }
  | { status: "last_admin" };

export async function runAdminDeactivate(rawEmail: string): Promise<DeactivateOutcome> {
  const email = rawEmail.toLowerCase();

  const { db } = await loadDb();
  const { user } = await import("../src/db/schema.ts");
  const { touched } = await import("../src/db/touched.ts");
  const { eq, sql } = await import("drizzle-orm");
  const { withLastAdminGuard, LastAdminRefusal } = await import("../src/features/auth/server/admin-guard.ts");
  const { deleteAllSessionsForUser } = await import("../src/features/auth/server/sessions.ts");

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: user.id, role: user.role, deactivatedAt: user.deactivatedAt })
      .from(user)
      .where(sql`lower(${user.email}) = ${email}`);

    if (!existing) {
      return { status: "unknown_address", email };
    }

    try {
      await withLastAdminGuard(tx, existing.id, async () => {
        await tx
          .update(user)
          .set(touched({ deactivatedAt: new Date() }))
          .where(eq(user.id, existing.id));
        await deleteAllSessionsForUser(existing.id, tx);
      });
    } catch (error) {
      if (error instanceof LastAdminRefusal) {
        return { status: "last_admin" };
      }
      throw error;
    }

    return { status: "deactivated" };
  });
}

export type CliIo = {
  stdout: { write: (text: string) => void };
  stderr: { write: (text: string) => void };
};

export async function runAdminDeactivateCli(argv: string[], io: CliIo): Promise<number> {
  const parsed = parseAdminDeactivateArgs(argv);
  if (!parsed.ok) {
    io.stderr.write(`${parsed.message}\n`);
    return 2;
  }

  const outcome = await runAdminDeactivate(parsed.args.email);
  if (outcome.status === "unknown_address") {
    io.stderr.write(`no account found for ${outcome.email}\n`);
    return 1;
  }
  if (outcome.status === "last_admin") {
    io.stderr.write("refusing to deactivate the only active admin\n");
    return 1;
  }

  io.stdout.write(`${parsed.args.email} is now deactivated\n`);
  return 0;
}

async function main(): Promise<void> {
  process.exitCode = await runAdminDeactivateCli(process.argv.slice(2), {
    stdout: process.stdout,
    stderr: process.stderr,
  });

  if (dbModulePromise) {
    const { client } = await dbModulePromise;
    await client.end({ timeout: 0 });
  }
}

const { pathToFileURL } = await import("node:url");
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}