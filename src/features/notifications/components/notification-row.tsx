"use client";

import Link from "next/link";
import { formatRelativeTime } from "@/lib/relative-time";
import { markNotificationRead } from "../actions";
import type { NotificationListItem, NotificationType } from "../server/notification-queries";

const TYPE_PHRASES: Record<NotificationType, string> = {
  mention: "mentioned you",
  assignment: "assigned you",
  comment: "commented",
};

export function NotificationRow({ item }: { item: NotificationListItem }) {
  return (
    <Link
      href={item.href}
      onNavigate={() => {
        markNotificationRead({ notificationId: item.id }).catch(() => undefined);
      }}
      className="flex items-baseline gap-2 px-4.5 py-2 text-control text-(--color-text) hover:bg-(--color-surface)">
      {item.isUnread ? (
        <>
          <span className="sr-only">Unread</span>
          <span
            aria-hidden="true"
            className="h-2 w-2 flex-none self-center rounded-full bg-(--color-accent)"
          />
        </>
      ) : (
        <span className="h-2 w-2 flex-none self-center" />
      )}
      <span className="font-medium">{item.actorName}</span>
      <span className="text-(--color-text-muted)">{TYPE_PHRASES[item.type]}</span>
      <span className="min-w-0 truncate">{item.targetLabel}</span>
      <span className="ms-auto flex-none font-mono text-label text-(--color-text-muted)">
        {formatRelativeTime(item.createdAt, new Date())}
      </span>
    </Link>
  );
}