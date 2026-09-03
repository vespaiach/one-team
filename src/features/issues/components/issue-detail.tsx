import type { ReactNode } from "react";
import type { IssueView } from "../server/issue-queries";
import { CopyableKey } from "./copyable-key";
import { IssueDescription } from "./issue-description";

const PRIORITY_LABELS: Record<IssueView["priority"], string> = {
  none: "No priority",
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

const TIMESTAMP_FORMAT = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

function RailField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <span className="text-label text-(--color-text-muted)">{label}</span>
      <p>{children}</p>
    </div>
  );
}

export function IssueDetail({ issue }: { issue: IssueView }) {
  return (
    <div className="flex gap-6 p-4">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <CopyableKey issueKey={issue.key} />
        <h1 className="text-h4">{issue.title}</h1>
        <IssueDescription description={issue.description} />
      </div>
      <aside
        aria-label="Issue details"
        className="flex w-[262px] shrink-0 flex-col gap-4">
        <RailField label="Column">{issue.column.name}</RailField>
        <RailField label="Priority">{PRIORITY_LABELS[issue.priority]}</RailField>
        <RailField label="Assignee">
          {issue.assignee ? `${issue.assignee.firstName} ${issue.assignee.lastName}` : "Unassigned"}
        </RailField>
        <RailField label="Due date">{issue.dueDate ?? "No due date"}</RailField>
        <RailField label="Project">{issue.project.name}</RailField>
        <RailField label="Created by">
          {issue.createdBy.firstName} {issue.createdBy.lastName}
        </RailField>
        <RailField label="Created">{TIMESTAMP_FORMAT.format(issue.createdAt)}</RailField>
        <RailField label="Updated">{TIMESTAMP_FORMAT.format(issue.updatedAt)}</RailField>
      </aside>
    </div>
  );
}