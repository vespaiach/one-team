import { Suspense } from "react";
import { requireActor } from "@/features/auth/server/actor";
import { MarkAllReadControl } from "@/features/notifications/components/mark-all-read-control";
import { NotificationsList } from "@/features/notifications/components/notifications-list";
import { NotificationsSkeleton } from "@/features/notifications/components/notifications-skeleton";
import { countUnreadNotifications } from "@/features/notifications/server/notification-queries";
import { ScreenHeader } from "@/features/shell/components/screen-header";

export default async function NotificationsPage() {
  const actor = await requireActor();
  const unreadCount = await countUnreadNotifications(actor.id);

  return (
    <>
      <ScreenHeader
        name="Notifications"
        control={<MarkAllReadControl unreadCount={unreadCount} />}
      />
      <Suspense fallback={<NotificationsSkeleton />}>
        <NotificationsList userId={actor.id} />
      </Suspense>
    </>
  );
}