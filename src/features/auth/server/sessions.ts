import "server-only";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { session } from "@/db/schema";
import { digestToken, issueToken } from "./crypto";

const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

export type SessionRecord = typeof session.$inferSelect;

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbOrTransaction = typeof db | Transaction;

export async function issueSession(params: {
  userId: string;
  ipAddress: string;
  userAgent: string | null;
  now?: Date;
}): Promise<{ token: string; session: SessionRecord }> {
  const now = params.now ?? new Date();
  const { token, digest } = issueToken();

  const [row] = await db
    .insert(session)
    .values({
      userId: params.userId,
      tokenDigest: digest,
      createdAt: now,
      lastSeenAt: now,
      expiresAt: new Date(now.getTime() + SESSION_LIFETIME_MS),
      userAgent: params.userAgent,
      ipAddress: params.ipAddress,
    })
    .returning();

  if (!row) {
    throw new Error("issueSession produced no row");
  }

  return { token, session: row };
}

export async function resolveSession(token: string, now: Date = new Date()): Promise<SessionRecord | null> {
  const digest = digestToken(token);

  const [row] = await db
    .select()
    .from(session)
    .where(and(eq(session.tokenDigest, digest), gt(session.expiresAt, now)));

  if (!row) {
    return null;
  }

  const slid = { lastSeenAt: now, expiresAt: new Date(now.getTime() + SESSION_LIFETIME_MS) };
  await db.update(session).set(slid).where(eq(session.id, row.id));

  return { ...row, ...slid };
}

export async function deleteAllSessionsForUser(
  userId: string,
  executor: DbOrTransaction = db,
): Promise<void> {
  await executor.delete(session).where(eq(session.userId, userId));
}