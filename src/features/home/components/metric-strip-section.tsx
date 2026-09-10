import { listAssignedIssues } from "../server/assigned-queries";
import { countOpenIssuesForTeam } from "../server/metrics-queries";
import { MetricStrip } from "./metric-strip";

export async function MetricStripSection({ userId }: { userId: string }) {
  const [assignedIssues, teamOpenCount] = await Promise.all([
    listAssignedIssues(userId),
    countOpenIssuesForTeam(),
  ]);

  return (
    <MetricStrip
      assignedCount={assignedIssues.length}
      dueThisWeekCount={assignedIssues.filter((issue) => issue.dueThisWeek).length}
      teamOpenCount={teamOpenCount}
    />
  );
}