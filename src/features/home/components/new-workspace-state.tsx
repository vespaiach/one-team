import Link from "next/link";
import type { ReactNode } from "react";

const LANDS_HERE_ROWS = [
  {
    term: "Assigned to you",
    description: "Issues with your name on them, grouped by the column they sit in.",
  },
  { term: "Projects", description: "Progress, open count and target date for every project you belong to." },
  { term: "Team activity", description: "Column moves, comments and roster changes, newest first." },
];

export function NewWorkspaceState({
  isAdmin,
  createProjectModal,
}: {
  isAdmin: boolean;
  createProjectModal: ReactNode;
}) {
  return (
    <div className="max-w-[70ch] overflow-y-auto p-8">
      <div className="font-mono text-[10.5px] text-(--color-text-muted) uppercase tracking-[0.1em]">
        One Team · no projects yet
      </div>
      <h2 className="mt-2 mb-3 font-serif font-semibold text-[38px] leading-[1.1] tracking-[-0.02em]">
        Nothing filed yet
      </h2>
      <p className="mb-8 max-w-[50ch] text-[15px] text-(--color-text-muted) leading-[1.55]">
        Work lives in projects. Each one carries its own columns, its own roster and its own history, and
        every issue belongs to exactly one. Create the first project and this page fills in on its own.
      </p>
      {isAdmin ? (
        <div className="mb-8 flex items-center gap-2">
          {createProjectModal}
          <Link
            href="/settings/accounts"
            className="flex h-[26px] items-center rounded-sm border border-(--color-divider) px-2.5 font-sans text-[12px] font-medium text-(--color-text) no-underline hover:bg-(--color-chrome-tint-strong)">
            Invite teammates
          </Link>
        </div>
      ) : (
        <p className="mb-8 max-w-[50ch] text-[14px] text-(--color-accent-700) leading-[1.55]">
          Projects and invitations are admin work. Once an admin adds you to a project, its board and your own
          queue appear here.
        </p>
      )}
      <div className="mb-1 text-[10px] font-medium text-(--color-text-muted) uppercase tracking-[0.11em]">
        What lands here
      </div>
      <dl>
        {LANDS_HERE_ROWS.map((row, index) => (
          <div
            key={row.term}
            className={`grid grid-cols-[160px_minmax(0,1fr)] gap-3 border-(--color-divider) py-2 ${
              index === LANDS_HERE_ROWS.length - 1 ? "border-t border-b" : "border-t"
            }`}>
            <dt className="font-mono text-[11.5px]">{row.term}</dt>
            <dd className="text-[13.5px] text-(--color-text-muted) leading-[1.5]">{row.description}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}