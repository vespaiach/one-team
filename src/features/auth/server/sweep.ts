import "server-only";
import { isNotNull, lt, or } from "drizzle-orm";
import { db } from "@/db";
import { authAttempt, resetToken, session } from "@/db/schema";
import { logUnhandledServerError } from "./log";

const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

export async function sweep(now: Date = new Date()): Promise<void> {
  await db
    .delete(authAttempt)
    .where(lt(authAttempt.attemptedAt, new Date(now.getTime() - ATTEMPT_WINDOW_MS)));
  await db.delete(session).where(lt(session.expiresAt, now));
  await db.delete(resetToken).where(or(isNotNull(resetToken.usedAt), lt(resetToken.expiresAt, now)));
}

export function startSweep(runSweep: (now?: Date) => Promise<void> = sweep): () => void {
  const timer = setInterval(() => {
    runSweep().catch(() => {
      logUnhandledServerError("sweep");
    });
  }, SWEEP_INTERVAL_MS);
  timer.unref();

  const onSigterm = () => clearInterval(timer);
  process.once("SIGTERM", onSigterm);

  return () => {
    clearInterval(timer);
    process.removeListener("SIGTERM", onSigterm);
  };
}