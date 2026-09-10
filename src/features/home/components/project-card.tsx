import Link from "next/link";
import { AvatarStack } from "@/components/ui/avatar-stack";
import { StatusRing } from "@/components/ui/status-ring";
import { progressBarWidths } from "../progress-bar-widths";
import { projectStatusRing } from "../project-status-ring";
import type { ProjectProgressRow } from "../server/project-queries";

const TARGET_DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const MEMBER_AVATAR_LIMIT = 3;

export function ProjectCard({ project }: { project: ProjectProgressRow }) {
  const { donePercent, todoPercent } = progressBarWidths(project);

  return (
    <Link
      href={project.href}
      className="grid gap-2 rounded-sm border border-(--color-divider) p-3 no-underline hover:border-(--color-text-muted)">
      <div className="flex items-center gap-2">
        <StatusRing status={projectStatusRing(project)} />
        <h3 className="min-w-0 truncate font-serif font-semibold text-[15px] text-(--color-text) tracking-[-0.01em]">
          {project.name}
        </h3>
        <span className="ms-auto font-mono text-[10.5px] text-(--color-text-muted)">{project.key}</span>
      </div>
      <div className="flex h-[5px] overflow-hidden rounded-[1px] bg-(--color-neutral-200)">
        <span
          className="h-full bg-(--color-accent-600)"
          style={{ width: `${donePercent}%` }}
        />
        <span
          className="h-full bg-(--color-accent-300)"
          style={{ width: `${todoPercent}%` }}
        />
      </div>
      <div className="flex items-center gap-2">
        {project.targetPassed ? (
          <span className="font-mono text-[11px] text-(--color-accent-2-700)">
            Target passed{" "}
            {project.targetDate === null ? "" : TARGET_DATE_FORMAT.format(new Date(project.targetDate))}
          </span>
        ) : (
          <>
            <span className="font-mono text-[11px] text-(--color-text-muted)">
              {project.openCount === 1 ? "1 open" : `${project.openCount} open`}
            </span>
            {project.targetDate === null ? null : (
              <>
                <span className="font-mono text-[11px] text-(--color-text-muted)">·</span>
                <span className="font-mono text-[11px] text-(--color-text-muted)">
                  {TARGET_DATE_FORMAT.format(new Date(project.targetDate))}
                </span>
              </>
            )}
          </>
        )}
        <span className="ms-auto">
          <AvatarStack
            people={project.members}
            limit={MEMBER_AVATAR_LIMIT}
          />
        </span>
      </div>
    </Link>
  );
}