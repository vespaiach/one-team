import Link from "next/link";
import { groupByColumn } from "../group-by-column";
import type { AssignedIssueRow } from "../server/assigned-queries";
import { PriorityGlyph } from "./priority-glyph";

const DUE_DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const GROUP_HEAD_CLASSES =
  "sticky top-0 z-[1] flex h-(--size-row) items-center gap-2 border-b border-(--color-divider) bg-(--color-chrome-tint) px-3 text-[10.5px] font-medium uppercase tracking-[0.1em]";

function Row({ issue }: { issue: AssignedIssueRow }) {
  return (
    <Link
      href={issue.href}
      className="grid h-(--size-row-lg) grid-cols-[14px_14px_auto_minmax(0,1fr)_auto] items-center gap-2 border-b border-(--color-divider) px-3 text-[13px] text-(--color-text) no-underline hover:bg-(--color-chrome-tint)">
      <span
        aria-hidden="true"
        className="h-[13px] w-[13px] rounded-sm border border-(--color-text-muted)"
      />
      <PriorityGlyph priority={issue.priority} />
      <span className="whitespace-nowrap font-mono text-[11px] text-(--color-text-muted)">{issue.key}</span>
      <span className="min-w-0 truncate">{issue.title}</span>
      <span className="flex items-center justify-self-end gap-2">
        {issue.label === null ? null : (
          <span className="flex h-[19px] items-center rounded-sm border border-(--color-divider) px-1.5 text-[11px] text-(--color-text-muted)">
            {issue.label}
          </span>
        )}
        <span className="flex h-[19px] items-center rounded-sm bg-(--color-accent-100) px-1.5 font-mono text-[11px] text-(--color-accent-800)">
          {issue.projectKey}
        </span>
        {issue.dueDate === null ? null : (
          <span className="font-mono text-[11px] text-(--color-text-muted)">
            {DUE_DATE_FORMAT.format(new Date(issue.dueDate))}
          </span>
        )}
      </span>
    </Link>
  );
}

export function AssignedList({
  issues,
  totalOpenCount,
}: {
  issues: AssignedIssueRow[];
  totalOpenCount: number;
}) {
  const groups = groupByColumn(
    issues.map((issue) => ({ ...issue, columnId: issue.column.id })),
    [...new Map(issues.map((issue) => [issue.column.id, issue.column])).values()],
  );

  return (
    <div className="flex flex-col">
      <div className="flex flex-col">
        {groups.map((group, index) => (
          <div key={group.name}>
            <div className={GROUP_HEAD_CLASSES}>
              <span>{group.name}</span>
              <span className="font-mono text-(--color-text-muted) tracking-normal">
                {group.items.length}
              </span>
              {index === 0 ? (
                <Link
                  href="/work?assignee=me"
                  className="ms-auto flex h-[26px] items-center rounded-sm px-2 font-sans text-[12px] font-medium text-(--color-text-muted) no-underline hover:bg-(--color-chrome-tint-strong) hover:text-(--color-text)">
                  Open in list
                </Link>
              ) : null}
            </div>
            {group.items.map((issue) => (
              <Row
                key={issue.id}
                issue={issue}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="p-3">
        <Link
          href="/work"
          className="text-(--color-accent) text-[12px] no-underline hover:underline">
          All {totalOpenCount} open issues →
        </Link>
      </div>
    </div>
  );
}