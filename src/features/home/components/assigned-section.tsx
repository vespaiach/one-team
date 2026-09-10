import type { NewIssueProjectPickerEntry } from "@/features/issues/components/new-issue-project-picker";
import { listAssignedIssues } from "../server/assigned-queries";
import { AssignedEmptyState } from "./assigned-empty-state";
import { AssignedList } from "./assigned-list";

export async function AssignedSection({
  userId,
  projects,
  totalOpenCount,
}: {
  userId: string;
  projects: NewIssueProjectPickerEntry[];
  totalOpenCount: number;
}) {
  const issues = await listAssignedIssues(userId);

  if (issues.length === 0) {
    return (
      <AssignedEmptyState
        totalOpenCount={totalOpenCount}
        projects={projects}
      />
    );
  }

  return (
    <AssignedList
      issues={issues}
      totalOpenCount={totalOpenCount}
    />
  );
}