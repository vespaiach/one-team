import Link from "next/link";
import type { IssuePriority } from "@/features/issues/server/input";
import type { AssignedIssueRow as AssignedIssue } from "../server/assigned-queries";

const DUE_DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const PRIORITY_NAMES: Record<Exclude<IssuePriority, "none">, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

const PRIORITY_BAR_HEIGHTS: Record<Exclude<IssuePriority, "none">, [number, number, number]> = {
  low: [4, 1, 1],
  medium: [4, 4, 1],
  high: [4, 4, 4],
  urgent: [4, 4, 4],
};

function PriorityGlyph({ priority }: { priority: Exclude<IssuePriority, "none"> }) {
  const [a, b, c] = PRIORITY_BAR_HEIGHTS[priority];
  const isUrgent = priority === "urgent";

  return (
    <span
      aria-hidden="true"
      className={`flex flex-none items-end gap-px ${isUrgent ? "text-(--color-danger)" : "text-(--color-text-muted)"}`}>
      <span
        className="w-[3px] bg-current"
        style={{ height: `${a}px` }}
      />
      <span
        className="w-[3px] bg-current"
        style={{ height: `${b}px` }}
      />
      <span
        className="w-[3px] bg-current"
        style={{ height: `${c}px` }}
      />
    </span>
  );
}

export function AssignedIssueRow({ issue }: { issue: AssignedIssue }) {
  return (
    <Link
      href={issue.href}
      className="flex items-baseline gap-2 px-4.5 py-2 text-control text-(--color-text) hover:bg-(--color-surface)">
      {issue.priority === "none" ? null : (
        <>
          <PriorityGlyph priority={issue.priority} />
          <span className="flex-none text-label text-(--color-text-muted)">
            {PRIORITY_NAMES[issue.priority]}
          </span>
        </>
      )}
      <span className="flex-none font-medium">{issue.key}</span>
      <span className="min-w-0 truncate">{issue.title}</span>
      <span className="ms-auto flex-none text-label text-(--color-text-muted)">{issue.projectName}</span>
      {issue.dueDate === null ? null : (
        <span className="flex-none text-label text-(--color-text-muted)">
          {DUE_DATE_FORMAT.format(new Date(issue.dueDate))}
        </span>
      )}
    </Link>
  );
}