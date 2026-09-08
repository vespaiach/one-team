import Link from "next/link";
import type { AssignedIssueRow as AssignedIssue } from "../server/assigned-queries";

export function AssignedIssueRow({ issue }: { issue: AssignedIssue }) {
  return (
    <Link
      href={issue.href}
      className="flex items-baseline gap-2 px-4.5 py-2 text-control text-(--color-text) hover:bg-(--color-surface)">
      <span className="flex-none font-medium font-mono">{issue.key}</span>
      <span className="min-w-0 truncate">{issue.title}</span>
      <span className="ms-auto flex-none text-label text-(--color-text-muted)">{issue.projectName}</span>
    </Link>
  );
}