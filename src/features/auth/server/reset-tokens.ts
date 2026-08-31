import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { resetToken } from "@/db/schema";
import { digestToken, issueToken } from "./crypto";

const RESET_TOKEN_LIFETIME_MS = 60 * 60 * 1000;

export type ResetTokenRecord = typeof resetToken.$inferSelect;
export type ResetTokenState = "valid" | "used" | "expired" | "unknown";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbOrTransaction = typeof db | Transaction;

export async function issueResetToken(params: {
  userId: string;
  now?: Date;
}): Promise<{ token: string; resetToken: ResetTokenRecord }> {
  const now = params.now ?? new Date();
  const { token, digest } = issueToken();

  const [row] = await db
    .insert(resetToken)
    .values({
      userId: params.userId,
      tokenDigest: digest,
      expiresAt: new Date(now.getTime() + RESET_TOKEN_LIFETIME_MS),
      createdAt: now,
    })
    .returning();

  if (!row) {
    throw new Error("issueResetToken produced no row");
  }

  return { token, resetToken: row };
}

export async function resolveResetTokenState(
  token: string,
  now: Date = new Date(),
): Promise<{ state: ResetTokenState; resetToken: ResetTokenRecord | null }> {
  const digest = digestToken(token);

  const [row] = await db.select().from(resetToken).where(eq(resetToken.tokenDigest, digest));

  if (!row) {
    return { state: "unknown", resetToken: null };
  }
  if (row.usedAt !== null) {
    return { state: "used", resetToken: row };
  }
  if (row.expiresAt <= now) {
    return { state: "expired", resetToken: row };
  }
  return { state: "valid", resetToken: row };
}

export async function spendResetToken(
  executor: DbOrTransaction,
  resetTokenId: string,
  now: Date = new Date(),
): Promise<ResetTokenRecord | null> {
  const [row] = await executor
    .update(resetToken)
    .set({ usedAt: now })
    .where(and(eq(resetToken.id, resetTokenId), isNull(resetToken.usedAt)))
    .returning();

  return row ?? null;
}