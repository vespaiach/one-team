import Link from "next/link";
import { Button } from "react-aria-components/Button";
import { StatusRing } from "@/components/ui/status-ring";
import { projectStatusRing } from "@/features/home/project-status-ring";
import type { CreateProjectPayload, CreateProjectState } from "@/features/projects/actions";
import { CreateProjectModal } from "@/features/projects/components/create-project-modal";
import type { RosterEntry } from "@/features/projects/server/queries";
import { splitOverflow } from "@/lib/overflow";

export type ProjectListRegionEntry = {
  key: string;
  name: string;
  status: "active" | "archived";
  openCount: number;
  done: number;
  counted: number;
};

const VISIBLE_PROJECT_LIMIT = 4;

const RAIL_ITEM_CLASSES =
  "flex h-(--size-row) items-center gap-2 overflow-hidden truncate rounded-sm px-[7px] text-[13px] no-underline hover:bg-(--color-chrome-tint-strong)";

export function ProjectListRegion({
  isAdmin,
  entries,
  createProjectAction,
  checkKeyAvailability,
  candidates,
}: {
  isAdmin: boolean;
  entries: ProjectListRegionEntry[];
  createProjectAction: (
    prevState: CreateProjectState,
    input: CreateProjectPayload,
  ) => Promise<CreateProjectState>;
  checkKeyAvailability: (key: string) => Promise<{ holder: { key: string; name: string } | null }>;
  candidates: RosterEntry[];
}) {
  const active = entries.filter((entry) => entry.status === "active");
  const { shown, overflowCount } = splitOverflow(active, VISIBLE_PROJECT_LIMIT);

  return (
    <div className="grid gap-px">
      <div className="flex h-[22px] items-center gap-1.5 px-[7px] text-[10px] font-medium text-(--color-text-muted) uppercase tracking-[0.11em]">
        <span>
          Projects <span className="font-mono tracking-normal">{active.length}</span>
        </span>
        {isAdmin ? (
          <CreateProjectModal
            createProjectAction={createProjectAction}
            checkKeyAvailability={checkKeyAvailability}
            candidates={candidates}
            trigger={
              <Button
                aria-label="New project"
                className="ms-auto flex h-5 w-5 items-center justify-center rounded-sm text-(--color-text-muted) hover:bg-(--color-chrome-tint-strong) hover:text-(--color-text)">
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 256 256"
                  fill="currentColor"
                  aria-hidden="true">
                  <path d="M176 120h-40V80a8 8 0 0 0-16 0v40H80a8 8 0 0 0 0 16h40v40a8 8 0 0 0 16 0v-40h40a8 8 0 0 0 0-16Z" />
                </svg>
              </Button>
            }
          />
        ) : null}
      </div>
      {active.length === 0 ? (
        <div className={`${RAIL_ITEM_CLASSES} text-(--color-text-muted)`}>No projects yet</div>
      ) : (
        <>
          {shown.map((entry) => (
            <Link
              key={entry.key}
              href={`/projects/${entry.key}`}
              className={RAIL_ITEM_CLASSES}>
              <StatusRing status={projectStatusRing(entry)} />
              <span className="min-w-0 flex-1 truncate">{entry.name}</span>
              <span className="font-mono text-(--color-text-muted) text-[10.5px]">{entry.openCount}</span>
            </Link>
          ))}
          {overflowCount > 0 ? (
            <div className={`${RAIL_ITEM_CLASSES} text-(--color-text-muted)`}>{overflowCount} more…</div>
          ) : null}
        </>
      )}
    </div>
  );
}