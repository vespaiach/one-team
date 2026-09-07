import { listAssignedIssues } from "../server/assigned-queries";
import { AssignedIssueRow } from "./assigned-issue-row";

const HEADING_ID = "home-assigned-heading";

export async function AssignedSection({ userId }: { userId: string }) {
  const issues = await listAssignedIssues(userId);

  return (
    <section
      aria-labelledby={HEADING_ID}
      className="flex flex-col gap-2">
      <h2
        id={HEADING_ID}
        className="px-4.5 text-label text-(--color-text-muted)">
        Assigned to you
      </h2>
      {issues.length === 0 ? (
        <p className="px-4.5 py-2 text-label text-(--color-text-muted)">Nothing is assigned to you.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-(--color-divider)">
          {issues.map((issue) => (
            <li key={issue.id}>
              <AssignedIssueRow issue={issue} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}