import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { notification } from "@/db/schema";

export type MarkReadOutcome = "ok" | "not-found";

export async function markNotificationRead(params: {
  userId: string;
  notificationId: string;
}): Promise<MarkReadOutcome> {
  const now = new Date();
  const marked = await db
    .update(notification)
    .set({ readAt: now, updatedAt: now })
    .where(
      and(
        eq(notification.id, params.notificationId),
        eq(notification.userId, params.userId),
        isNull(notification.readAt),
      ),
    )
    .returning({ id: notification.id });

  if (marked.length > 0) {
    return "ok";
  }

  const [alreadyRead] = await db
    .select({ id: notification.id })
    .from(notification)
    .where(and(eq(notification.id, params.notificationId), eq(notification.userId, params.userId)));

  return alreadyRead ? "ok" : "not-found";
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const now = new Date();
  await db
    .update(notification)
    .set({ readAt: now, updatedAt: now })
    .where(and(eq(notification.userId, userId), isNull(notification.readAt)));
}