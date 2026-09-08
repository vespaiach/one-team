import { countUnreadNotifications } from "@/features/notifications/server/notification-queries";
import { listAssignedIssues } from "../server/assigned-queries";

export async function StatCards({ userId }: { userId: string }) {
  const assigned = await listAssignedIssues(userId);
  const unread = await countUnreadNotifications(userId);

  const cards = [
    { label: "Assigned to you", count: assigned.length },
    { label: "Due this week", count: assigned.filter((row) => row.dueThisWeek).length },
    { label: "Unread", count: unread },
  ];

  return (
    <ul className="flex gap-3 px-4.5">
      {cards.map((card) => (
        <li
          key={card.label}
          className="flex flex-1 flex-col gap-1 rounded-[var(--radius-md)] border border-(--color-divider) px-4 py-3">
          <span className="text-h5 text-(--color-text)">{card.count}</span>
          <span className="text-label text-(--color-text-muted)">{card.label}</span>
        </li>
      ))}
    </ul>
  );
}