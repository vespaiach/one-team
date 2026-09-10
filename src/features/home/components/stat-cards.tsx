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
    <ul className="flex gap-8 border-b-2 border-(--color-border) px-4.5 pb-4.5">
      {cards.map((card) => (
        <li
          key={card.label}
          className="flex flex-col gap-1">
          <span className="text-h3 text-(--color-accent)">{card.count}</span>
          <span className="text-label text-(--color-text-muted) uppercase tracking-[0.08em]">
            {card.label}
          </span>
        </li>
      ))}
    </ul>
  );
}