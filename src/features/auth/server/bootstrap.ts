import "server-only";
import postgres from "postgres";
import { db } from "@/db";
import { credential, user } from "@/db/schema";
import { touched } from "@/db/touched";
import { hashPassword } from "./crypto";
import { parseEmail } from "./input";
import { logRefusedFirstRunSeed } from "./log";
import { assertPasswordPolicy, type PasswordPolicyFailure } from "./password-policy";
import { startSweep } from "./sweep";

export type BootstrapFailureReason =
  | "missing_app_url"
  | "invalid_app_url"
  | "database_unreachable"
  | "invalid_admin_email"
  | PasswordPolicyFailure;

export class BootstrapRefusalError extends Error {
  readonly reason: BootstrapFailureReason;

  constructor(reason: BootstrapFailureReason, message: string) {
    super(message);
    this.reason = reason;
  }
}

export type SeedOutcome = "seeded" | "skipped_existing_users" | "skipped_no_admin_email" | "already_seeded";

export interface BootstrapEnv {
  appUrl: string | undefined;
  databaseUrl: string | undefined;
  adminEmail: string | undefined;
  adminPassword: string | undefined;
}

function hasUniqueViolationCode(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

function isUniqueViolation(error: unknown): boolean {
  if (hasUniqueViolationCode(error)) {
    return true;
  }
  return error instanceof Error && hasUniqueViolationCode(error.cause);
}

export function assertAppUrl(value: string | undefined): void {
  if (!value) {
    throw new BootstrapRefusalError("missing_app_url", "APP_URL is not set");
  }
  try {
    new URL(value);
  } catch {
    throw new BootstrapRefusalError("invalid_app_url", "APP_URL is not a valid URL");
  }
}

export async function assertDatabaseReachable(databaseUrl: string | undefined): Promise<void> {
  if (!databaseUrl) {
    throw new BootstrapRefusalError("database_unreachable", "DATABASE_URL is not set");
  }

  const client = postgres(databaseUrl, { max: 1, connect_timeout: 5 });
  try {
    await client`select 1`;
  } catch {
    throw new BootstrapRefusalError("database_unreachable", "could not reach the database");
  } finally {
    await client.end({ timeout: 0 });
  }
}

export async function seedFirstAdmin(params: {
  adminEmail: string | undefined;
  adminPassword: string | undefined;
}): Promise<SeedOutcome> {
  try {
    return await db.transaction(async (tx) => {
      const [existing] = await tx.select({ id: user.id }).from(user).limit(1);
      if (existing) {
        return "skipped_existing_users";
      }

      if (!params.adminEmail) {
        return "skipped_no_admin_email";
      }

      const email = parseEmail(params.adminEmail);
      if (!email) {
        throw new BootstrapRefusalError("invalid_admin_email", "ADMIN_EMAIL is not a valid address");
      }

      const passwordFailure = assertPasswordPolicy(params.adminPassword ?? "");
      if (passwordFailure) {
        throw new BootstrapRefusalError(passwordFailure, `ADMIN_PASSWORD is ${passwordFailure}`);
      }

      const passwordHash = await hashPassword(params.adminPassword as string);
      const now = new Date();

      const [createdUser] = await tx
        .insert(user)
        .values(
          touched({
            firstName: "Admin",
            lastName: "Admin",
            email,
            role: "admin",
            mustChangePassword: true,
            createdAt: now,
          }),
        )
        .returning();

      if (!createdUser) {
        throw new Error("seedFirstAdmin produced no user row");
      }

      await tx.insert(credential).values(touched({ userId: createdUser.id, passwordHash, createdAt: now }));

      return "seeded";
    });
  } catch (error) {
    if (error instanceof BootstrapRefusalError) {
      throw error;
    }
    if (isUniqueViolation(error)) {
      return "already_seeded";
    }
    throw error;
  }
}

export async function bootstrap(
  env: BootstrapEnv,
  deps: { startSweep?: typeof startSweep } = {},
): Promise<void> {
  try {
    assertAppUrl(env.appUrl);
    await assertDatabaseReachable(env.databaseUrl);
    await seedFirstAdmin({ adminEmail: env.adminEmail, adminPassword: env.adminPassword });
    (deps.startSweep ?? startSweep)();
  } catch (error) {
    if (!(error instanceof BootstrapRefusalError)) {
      throw error;
    }
    logRefusedFirstRunSeed(env.adminEmail ?? "unknown");
    process.stderr.write(`${error.reason}: ${error.message}\n`);
    process.exit(1);
  }
}