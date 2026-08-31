import "server-only";
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { authAttempt } from "@/db/schema";
import { logThrottleRefusal } from "./log";

export type AttemptFlow = "signin" | "reset";
type AttemptKind = "email" | "ip";

const WINDOW_MS = 15 * 60 * 1000;
const LIMITS: Record<AttemptKind, number> = { email: 5, ip: 20 };

export class ThrottledError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super("throttled");
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function lockSubject(
  tx: Transaction,
  flow: AttemptFlow,
  kind: AttemptKind,
  subject: string,
): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`${flow}:${kind}:${subject}`}))`);
}

async function countInWindow(
  tx: Transaction,
  flow: AttemptFlow,
  kind: AttemptKind,
  subject: string,
  now: Date,
): Promise<{ count: number; oldestAttemptedAt: Date | null }> {
  const windowStart = new Date(now.getTime() - WINDOW_MS);
  const rows = await tx
    .select({ attemptedAt: authAttempt.attemptedAt })
    .from(authAttempt)
    .where(
      and(
        eq(authAttempt.flow, flow),
        eq(authAttempt.kind, kind),
        eq(authAttempt.subject, subject),
        gt(authAttempt.attemptedAt, windowStart),
      ),
    );

  const oldestAttemptedAt = rows.reduce<Date | null>(
    (oldest, row) => (oldest === null || row.attemptedAt < oldest ? row.attemptedAt : oldest),
    null,
  );

  return { count: rows.length, oldestAttemptedAt };
}

function retryAfterSecondsFrom(oldestAttemptedAt: Date, now: Date): number {
  const clearsAt = oldestAttemptedAt.getTime() + WINDOW_MS;
  return Math.max(0, Math.ceil((clearsAt - now.getTime()) / 1000));
}

export async function assertNotThrottled(params: {
  flow: AttemptFlow;
  email: string;
  ip: string;
  now?: Date;
}): Promise<void> {
  const now = params.now ?? new Date();
  const subjects: Array<[AttemptKind, string]> = [
    ["email", params.email],
    ["ip", params.ip],
  ];

  await db.transaction(async (tx) => {
    let latestRetryAfterSeconds: number | null = null;

    for (const [kind, subject] of subjects) {
      await lockSubject(tx, params.flow, kind, subject);
      const { count, oldestAttemptedAt } = await countInWindow(tx, params.flow, kind, subject, now);

      if (count >= LIMITS[kind] && oldestAttemptedAt) {
        const retryAfterSeconds = retryAfterSecondsFrom(oldestAttemptedAt, now);
        latestRetryAfterSeconds =
          latestRetryAfterSeconds === null
            ? retryAfterSeconds
            : Math.max(latestRetryAfterSeconds, retryAfterSeconds);
      }
    }

    if (latestRetryAfterSeconds !== null) {
      logThrottleRefusal(params.email);
      throw new ThrottledError(latestRetryAfterSeconds);
    }
  });
}

export async function recordFailure(params: {
  flow: AttemptFlow;
  email: string;
  ip: string;
  now?: Date;
}): Promise<void> {
  const now = params.now ?? new Date();
  const subjects: Array<[AttemptKind, string]> = [
    ["email", params.email],
    ["ip", params.ip],
  ];

  await db.transaction(async (tx) => {
    for (const [kind, subject] of subjects) {
      await lockSubject(tx, params.flow, kind, subject);
      await tx.insert(authAttempt).values({ flow: params.flow, kind, subject, attemptedAt: now });
    }
  });
}

export async function clearSignInAttempts(email: string): Promise<void> {
  await db
    .delete(authAttempt)
    .where(
      and(eq(authAttempt.flow, "signin"), eq(authAttempt.kind, "email"), eq(authAttempt.subject, email)),
    );
}