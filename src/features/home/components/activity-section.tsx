import { listInstallationActivity } from "../server/activity-queries";
import { ActivityRow } from "./activity-row";

const HEADING_ID = "home-activity-heading";

export async function ActivitySection() {
  const rows = await listInstallationActivity();

  return (
    <section
      aria-labelledby={HEADING_ID}
      className="flex flex-col">
      <h2
        id={HEADING_ID}
        className="px-4.5 py-2 text-label text-(--color-text-muted)">
        Recent activity
      </h2>
      {rows.length === 0 ? (
        <p className="px-4.5 py-2 text-label text-(--color-text-muted)">Nothing has happened yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-(--color-divider)">
          {rows.map((row) => (
            <li key={row.id}>
              <ActivityRow row={row} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}