"use client";

import Link from "next/link";
import { markNotificationRead } from "../actions";
import type { NotificationListItem, NotificationType } from "../server/notification-queries";

const TYPE_PHRASES: Record<NotificationType, string> = {
  mention: "mentioned you",
  assignment: "assigned you",
  comment: "commented",
};

const RELATIVE_TIME_FORMAT = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });

const RELATIVE_TIME_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 60 * 60],
  ["month", 30 * 24 * 60 * 60],
  ["day", 24 * 60 * 60],
  ["hour", 60 * 60],
  ["minute", 60],
];

function formatRelativeTime(createdAt: Date, now: Date): string {
  const seconds = Math.round((createdAt.getTime() - now.getTime()) / 1000);
  for (const [unit, unitSeconds] of RELATIVE_TIME_UNITS) {
    if (Math.abs(seconds) >= unitSeconds) {
      return RELATIVE_TIME_FORMAT.format(Math.round(seconds / unitSeconds), unit);
    }
  }
  return RELATIVE_TIME_FORMAT.format(0, "minute");
}

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
      <span className="ms-auto flex-none text-label text-(--color-text-muted)">
        {formatRelativeTime(item.createdAt, new Date())}
      </span>
    </Link>
  );
}