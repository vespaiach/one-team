import { listRecentMentions } from "@/features/notifications/server/notification-queries";
import { MentionRow } from "./mention-row";

const HEADING_ID = "home-mentions-heading";

const MENTIONS_LIMIT = 5;

export async function MentionsSection({ userId }: { userId: string }) {
  const items = await listRecentMentions(userId, MENTIONS_LIMIT);

  return (
    <section
      aria-labelledby={HEADING_ID}
      className="flex flex-col">
      <h2
        id={HEADING_ID}
        className="px-4.5 py-2 text-label text-(--color-text-muted)">
        Mentions
      </h2>
      {items.length === 0 ? (
        <p className="px-4.5 py-2 text-label text-(--color-text-muted)">No one has mentioned you yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-(--color-divider)">
          {items.map((item) => (
            <li key={item.id}>
              <MentionRow item={item} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}