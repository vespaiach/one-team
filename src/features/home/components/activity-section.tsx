import { listInstallationActivity } from "../server/activity-queries";
import { ActivityFeedItem } from "./activity-feed-item";

const HEADING_ID = "home-activity-heading";

export async function ActivitySection() {
  const rows = await listInstallationActivity();

  return (
    <section
      aria-labelledby={HEADING_ID}
      className="grid gap-1 border-t border-(--color-divider) p-3">
      <div
        id={HEADING_ID}
        className="mb-1 flex h-[22px] items-center text-[10px] font-medium text-(--color-text-muted) uppercase tracking-[0.11em]">
        Team activity
      </div>
      {rows.length === 0 ? (
        <p className="text-[12px] text-(--color-text-muted)">Nothing has happened yet.</p>
      ) : (
        <div className="relative grid pl-[26px]">
          <span
            aria-hidden="true"
            className="absolute top-2 bottom-2 left-[10px] w-px bg-(--color-divider)"
          />
          {rows.map((row) => (
            <ActivityFeedItem
              key={row.id}
              row={row}
            />
          ))}
        </div>
      )}
    </section>
  );
}