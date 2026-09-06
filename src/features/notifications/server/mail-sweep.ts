import "server-only";
import { and, gt, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { notification } from "@/db/schema";
import { sendNotificationMail } from "./mail";

const RETRY_WINDOW_MS = 60 * 60 * 1000;
const MAX_SEND_ATTEMPTS = 4;

export async function sweepNotificationMail(now: Date = new Date()): Promise<void> {
  const due = await db
    .select({ id: notification.id })
    .from(notification)
    .where(
      and(
        isNull(notification.emailedAt),
        lt(notification.sendAttempts, MAX_SEND_ATTEMPTS),
        gt(notification.createdAt, new Date(now.getTime() - RETRY_WINDOW_MS)),
        sql`${notification.createdAt} < ${now.toISOString()}::timestamptz - make_interval(mins => ${notification.sendAttempts} * 15)`,
      ),
    );

  for (const row of due) {
    await sendNotificationMail(row.id);
  }
}