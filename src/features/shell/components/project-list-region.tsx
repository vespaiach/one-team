import Link from "next/link";

export function ProjectListRegion({ isAdmin }: { isAdmin: boolean }) {
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
      <p className="mt-1 text-label text-(--color-text-muted)">No projects yet.</p>
    </section>
  );
}