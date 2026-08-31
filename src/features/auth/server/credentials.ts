import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { credential, user } from "@/db/schema";
import { touched } from "@/db/touched";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbOrTransaction = typeof db | Transaction;

export type SignInCandidate = {
  userId: string;
  role: string;
  deactivatedAt: Date | null;
  passwordHash: string | null;
};

export async function findSignInCandidate(email: string): Promise<SignInCandidate | null> {
  const [row] = await db
    .select({
      userId: user.id,
      role: user.role,
      deactivatedAt: user.deactivatedAt,
      passwordHash: credential.passwordHash,
    })
    .from(user)
    .leftJoin(credential, eq(credential.userId, user.id))
    .where(sql`lower(${user.email}) = ${email}`);

  return row ?? null;
}

export type ResetCandidate = {
  userId: string;
  deactivatedAt: Date | null;
  hasCredential: boolean;
};

export async function findResetCandidate(email: string): Promise<ResetCandidate | null> {
  const [row] = await db
    .select({ userId: user.id, deactivatedAt: user.deactivatedAt, credentialId: credential.id })
    .from(user)
    .leftJoin(credential, eq(credential.userId, user.id))
    .where(eq(user.email, email));

  if (!row) {
    return null;
  }
  return { userId: row.userId, deactivatedAt: row.deactivatedAt, hasCredential: row.credentialId !== null };
}

export async function setCredentialPassword(
  executor: DbOrTransaction,
  userId: string,
  passwordHash: string,
): Promise<void> {
  await executor.update(credential).set(touched({ passwordHash })).where(eq(credential.userId, userId));
}