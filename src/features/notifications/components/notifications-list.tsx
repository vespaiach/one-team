import { listNotifications } from "../server/notification-queries";
import { NotificationRow } from "./notification-row";

export async function NotificationsList({ userId }: { userId: string }) {
  const items = await listNotifications(userId);

  if (items.length === 0) {
    return <p className="px-4.5 py-3 text-label text-(--color-text-muted)">No notifications yet.</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-(--color-divider)">
      {items.map((item) => (
        <li key={item.id}>
          <NotificationRow item={item} />
        </li>
      ))}
    </ul>
  );
}