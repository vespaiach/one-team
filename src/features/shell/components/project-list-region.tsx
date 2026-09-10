import Link from "next/link";

export type ProjectListRegionEntry = {
  key: string;
  name: string;
  status: "active" | "archived";
};

function StatusDot({ status }: { status: ProjectListRegionEntry["status"] }) {
  return (
    <span
      aria-hidden="true"
      className={`me-2 inline-block h-1.5 w-1.5 rounded-full align-middle ${
        status === "active" ? "bg-(--color-accent)" : "border border-(--color-text-muted) bg-transparent"
      }`}
    />
  );
}

export function ProjectListRegion({
  isAdmin,
  entries,
}: {
  isAdmin: boolean;
  entries: ProjectListRegionEntry[];
}) {
  return (
    <section className="min-h-0 flex-1 overflow-y-auto px-4.5 py-2">
      <div className="flex items-center justify-between">
        <span className="text-label text-(--color-text-muted)">Projects</span>
        {isAdmin ? (
          <Link
            href="/projects/new"
            aria-label="New project"
            className="flex items-center justify-center text-control text-(--color-text-muted) hover:text-(--color-text)">
            <svg
              width="13"
              height="13"
              viewBox="0 0 256 256"
              fill="currentColor"
              aria-hidden="true">
              <path d="M176 120h-40V80a8 8 0 0 0-16 0v40H80a8 8 0 0 0 0 16h40v40a8 8 0 0 0 16 0v-40h40a8 8 0 0 0 0-16Z" />
            </svg>
          </Link>
        ) : null}
      </div>
      {entries.length === 0 ? (
        <p className="mt-1 text-label text-(--color-text-muted)">No projects yet.</p>
      ) : (
        <ul className="mt-1 flex flex-col">
          {entries.map((entry) => (
            <li key={entry.key}>
              <Link
                href={`/projects/${entry.key}`}
                className={`block truncate py-1 text-control ${
                  entry.status === "archived" ? "text-(--color-text-muted)" : "text-(--color-text)"
                }`}>
                <StatusDot status={entry.status} />
                {entry.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}