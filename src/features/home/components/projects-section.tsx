import { listMemberProjectsWithProgress } from "../server/project-queries";
import { ProjectProgressRow } from "./project-progress-row";

const HEADING_ID = "home-projects-heading";

export async function ProjectsSection({ userId }: { userId: string }) {
  const rows = await listMemberProjectsWithProgress(userId);

  return (
    <section
      aria-labelledby={HEADING_ID}
      className="flex flex-col">
      <h2
        id={HEADING_ID}
        className="px-4.5 py-2 text-label text-(--color-text-muted)">
        Your projects
      </h2>
      {rows.length === 0 ? (
        <p className="px-4.5 py-2 text-label text-(--color-text-muted)">No projects yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-(--color-divider)">
          {rows.map((row) => (
            <li key={row.key}>
              <ProjectProgressRow row={row} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}