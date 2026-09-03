import Link from "next/link";

export type ProjectListRegionEntry = {
  key: string;
  name: string;
  status: "active" | "archived";
};

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
            className="text-control text-(--color-text-muted)">
            +
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
                className={`block truncate text-control ${
                  entry.status === "archived" ? "text-(--color-text-muted)" : "text-(--color-text)"
                }`}>
                {entry.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}