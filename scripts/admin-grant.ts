import { createInterface } from "node:readline";
import { parseArgs } from "node:util";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

export type AdminGrantArgs = { email: string; firstName: string; lastName: string };
export type ArgsResult = { ok: true; args: AdminGrantArgs } | { ok: false; message: string };

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 200;

function foldEmail(value: string): string | null {
  if (value.length > MAX_EMAIL_LENGTH || !EMAIL_SHAPE.test(value)) {
    return null;
  }
  return value.toLowerCase();
}

export function parseAdminGrantArgs(argv: string[]): ArgsResult {
  let values: { email?: string; "first-name"?: string; "last-name"?: string };
  try {
    ({ values } = parseArgs({
      args: argv,
      options: {
        email: { type: "string" },
        "first-name": { type: "string" },
        "last-name": { type: "string" },
      },
      strict: true,
      allowPositionals: false,
    }));
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "invalid arguments" };
  }

  if (!values.email || !values["first-name"] || !values["last-name"]) {
    return {
      ok: false,
      message: "usage: admin:grant --email=<address> --first-name=<name> --last-name=<name>",
    };
  }

  const email = foldEmail(values.email);
  if (!email) {
    return { ok: false, message: "the email address is not valid" };
  }

  return { ok: true, args: { email, firstName: values["first-name"], lastName: values["last-name"] } };
}

const CARRIAGE_RETURN = "\r";
const NEWLINE = "\n";
const CTRL_C = String.fromCharCode(3);
const BACKSPACE = String.fromCharCode(8);
const DELETE = String.fromCharCode(127);

type HiddenInputStream = NodeJS.ReadableStream & { isTTY?: boolean; setRawMode?: (mode: boolean) => void };

export function promptHiddenPassword(
  input: HiddenInputStream,
  output: NodeJS.WritableStream,
): Promise<string> {
  if (!input.isTTY || typeof input.setRawMode !== "function") {
    return Promise.reject(new Error("cannot prompt for a password without an interactive terminal"));
  }

  return new Promise((resolve, reject) => {
    const rl = createInterface({ input, output, terminal: true });
    output.write("Password: ");
    input.setRawMode?.(true);

    let password = "";
    const finish = (result: { password: string } | { error: Error }) => {
      input.setRawMode?.(false);
      input.removeListener("data", onData);
      rl.close();
      if ("error" in result) {
        reject(result.error);
      } else {
        output.write("\n");
        resolve(result.password);
      }
    };

    const onData = (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      if (text === CARRIAGE_RETURN || text === NEWLINE) {
        finish({ password });
        return;
      }
      if (text === CTRL_C) {
        finish({ error: new Error("aborted") });
        return;
      }
      if (text === BACKSPACE || text === DELETE) {
        password = password.slice(0, -1);
        return;
      }
      password += text;
    };

    input.on("data", onData);
  });
}

let dbModulePromise: ReturnType<typeof importDb> | null = null;

function importDb() {
  return import("../src/db/index.ts");
}

function loadDb() {
  dbModulePromise ??= importDb();
  return dbModulePromise;
}

export type GrantOutcome =
  | { status: "created" }
  | { status: "promoted" }
  | { status: "reopened" }
  | { status: "password_replaced" }
  | { status: "policy"; failure: "too_short" | "too_long" | "blocklisted" };

export async function runAdminGrant(args: AdminGrantArgs, password: string): Promise<GrantOutcome> {
  const { assertPasswordPolicy } = await import("../src/features/auth/server/password-policy.ts");
  const failure = assertPasswordPolicy(password);
  if (failure) {
    return { status: "policy", failure };
  }

  const { hashPassword } = await import("../src/features/auth/server/crypto.ts");
  const passwordHash = await hashPassword(password);

  const { db } = await loadDb();
  const { user, credential } = await import("../src/db/schema.ts");
  const { touched } = await import("../src/db/touched.ts");
  const { eq, sql } = await import("drizzle-orm");
  const now = new Date();
  const email = args.email.toLowerCase();

  type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

  async function promote(
    tx: Transaction,
    existing: { id: string; role: string; deactivatedAt: Date | null },
  ): Promise<GrantOutcome> {
    const wasActiveAdmin = existing.role === "admin" && existing.deactivatedAt === null;
    const wasDeactivated = existing.deactivatedAt !== null;

    await tx
      .update(user)
      .set(touched({ role: "admin", deactivatedAt: null, mustChangePassword: false }))
      .where(eq(user.id, existing.id));

    const [existingCredential] = await tx
      .select({ id: credential.id })
      .from(credential)
      .where(eq(credential.userId, existing.id));
    if (existingCredential) {
      await tx
        .update(credential)
        .set(touched({ passwordHash }))
        .where(eq(credential.id, existingCredential.id));
    } else {
      await tx.insert(credential).values(touched({ userId: existing.id, passwordHash, createdAt: now }));
    }

    if (wasActiveAdmin) {
      return { status: "password_replaced" };
    }
    if (wasDeactivated) {
      return { status: "reopened" };
    }
    return { status: "promoted" };
  }

  function isUniqueViolation(error: unknown): boolean {
    const code = (value: unknown): string | undefined =>
      typeof value === "object" && value !== null && "code" in value
        ? String((value as { code: unknown }).code)
        : undefined;
    return code(error) === "23505" || (error instanceof Error && code(error.cause) === "23505");
  }

  try {
    return await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: user.id, role: user.role, deactivatedAt: user.deactivatedAt })
        .from(user)
        .where(sql`lower(${user.email}) = ${email}`);

      if (existing) {
        return promote(tx, existing);
      }

      const [created] = await tx
        .insert(user)
        .values(
          touched({
            firstName: args.firstName,
            lastName: args.lastName,
            email,
            role: "admin",
            mustChangePassword: false,
            createdAt: now,
          }),
        )
        .returning();
      if (!created) {
        throw new Error("runAdminGrant produced no user row");
      }
      await tx.insert(credential).values(touched({ userId: created.id, passwordHash, createdAt: now }));
      return { status: "created" };
    });
  } catch (error) {
    if (!isUniqueViolation(error)) {
      throw error;
    }
    return db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: user.id, role: user.role, deactivatedAt: user.deactivatedAt })
        .from(user)
        .where(sql`lower(${user.email}) = ${email}`);
      if (!existing) {
        throw new Error("expected a row to exist after a unique violation");
      }
      return promote(tx, existing);
    });
  }
}

export type CliIo = {
  readPassword: () => Promise<string>;
  stdout: { write: (text: string) => void };
  stderr: { write: (text: string) => void };
};

export async function runAdminGrantCli(argv: string[], io: CliIo): Promise<number> {
  const parsed = parseAdminGrantArgs(argv);
  if (!parsed.ok) {
    io.stderr.write(`${parsed.message}\n`);
    return 2;
  }

  let password: string;
  try {
    password = await io.readPassword();
  } catch {
    io.stderr.write("cannot prompt for a password without an interactive terminal\n");
    return 1;
  }

  const outcome = await runAdminGrant(parsed.args, password);
  if (outcome.status === "policy") {
    io.stderr.write(`password ${outcome.failure}\n`);
    return 1;
  }

  io.stdout.write(`${parsed.args.email} is now an admin (${outcome.status})\n`);
  return 0;
}

async function main(): Promise<void> {
  process.exitCode = await runAdminGrantCli(process.argv.slice(2), {
    readPassword: () => promptHiddenPassword(process.stdin, process.stdout),
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