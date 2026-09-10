import { listMemberProjectsWithProgress } from "../server/project-queries";
import { ProjectCard } from "./project-card";

const HEADING_ID = "home-projects-heading";

export async function ProjectsSection({ userId }: { userId: string }) {
  const projects = await listMemberProjectsWithProgress(userId);

  return (
    <section
      aria-labelledby={HEADING_ID}
      className="grid gap-2 p-3">
      <div className="flex h-[22px] items-center gap-1.5 text-[10px] font-medium text-(--color-text-muted) uppercase tracking-[0.11em]">
        <span id={HEADING_ID}>Projects</span>
        <span className="font-mono tracking-normal">{projects.length}</span>
      </div>
      {projects.length === 0 ? (
        <p className="text-[12px] text-(--color-text-muted)">No projects yet.</p>
      ) : (
        <div className="grid gap-2">
          {projects.map((project) => (
            <ProjectCard
              key={project.key}
              project={project}
            />
          ))}
        </div>
      )}
    </section>
  );
}