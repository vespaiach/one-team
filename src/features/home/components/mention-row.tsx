import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import type { NotificationListItem } from "@/features/notifications/server/notification-queries";
import { formatRelativeTime } from "@/lib/relative-time";

export function MentionRow({ item }: { item: NotificationListItem }) {
  return (
    <Link
      href={item.href}
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
      <Avatar
        name={item.actorName}
        avatarUrl={item.actorAvatarUrl}
        size="sm"
        decorative
      />
      <span className="font-medium">{item.actorName}</span>
      <span className="text-(--color-text-muted)">mentioned you</span>
      <span className="min-w-0 truncate">{item.targetLabel}</span>
      <span className="ms-auto flex-none text-label text-(--color-text-muted)">
        {formatRelativeTime(item.createdAt, new Date())}
      </span>
    </Link>
  );
}