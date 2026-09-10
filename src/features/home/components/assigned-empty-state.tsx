import Link from "next/link";
import {
  NewIssueProjectPicker,
  type NewIssueProjectPickerEntry,
} from "@/features/issues/components/new-issue-project-picker";

export function AssignedEmptyState({
  totalOpenCount,
  projects,
}: {
  totalOpenCount: number;
  projects: NewIssueProjectPickerEntry[];
}) {
  return (
    <div className="max-w-[58ch] p-3 pt-6 pb-6 pr-4">
      <div className="font-mono text-[10.5px] text-(--color-text-muted) uppercase tracking-[0.1em]">
        Assigned to you · none
      </div>
      <h2 className="mt-1 mb-2 font-serif font-semibold text-[27px] leading-[1.15] tracking-[-0.02em]">
        Your queue is clear
      </h2>
      <p className="mb-4 max-w-[48ch] text-[14.5px] text-(--color-text-muted) leading-[1.55]">
        Issues appear here when someone assigns one to you, or when you pick one up from a board. Nothing is
        waiting on you today.
      </p>
      <div className="flex items-center gap-2">
        <Link
          href="/work"
          className="flex h-[26px] items-center rounded-sm border border-(--color-divider) px-2.5 font-sans text-[12px] font-medium text-(--color-text) no-underline hover:bg-(--color-chrome-tint-strong)">
          All {totalOpenCount} open issues →
        </Link>
        <NewIssueProjectPicker projects={projects} />
      </div>
    </div>
  );
}