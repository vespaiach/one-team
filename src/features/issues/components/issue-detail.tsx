import type { ReactNode } from "react";
import { Suspense } from "react";
import { Feed } from "@/features/activity/components/feed";
import type { FeedFilterValue } from "@/features/activity/components/feed-filter-toggle";
import { FeedSkeleton } from "@/features/activity/components/feed-skeleton";
import type { FeedPage } from "@/features/activity/server/feed-queries";
import { addIssueLabel, removeIssueLabel } from "@/features/labels/actions";
import type { LabelOption } from "@/features/labels/server/queries";
import { deleteIssue, updateIssue } from "../actions";
import type { AssigneeOption, IssueColumnOption, IssueView } from "../server/issue-queries";
import { CopyableKey } from "./copyable-key";
import { DeleteIssueControl } from "./delete-issue-control";
import { EditableText } from "./editable-text";
import { IssueRail } from "./issue-rail";

type Viewer = { id: string; firstName: string; lastName: string; avatarUrl: string | null };

const TIMESTAMP_FORMAT = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

function RailField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <span className="text-label text-(--color-text-muted)">{label}</span>
      <p>{children}</p>
    </div>
  );
}

export function IssueDetail({
  issue,
  columns,
  assigneePool,
  canWrite,
  writeReason,
  canDelete = false,
  deleteReason = "",
  labelOptions = [],
  canManageLabels = false,
  feedInitialPage = { rows: [], hasNextPage: false },
  canComment = false,
  commentPostReason = null,
  viewer = null,
  feedFilter = "all",
}: {
  issue: IssueView;
  columns: IssueColumnOption[];
  assigneePool: AssigneeOption[];
  canWrite: boolean;
  writeReason: string;
  canDelete?: boolean;
  deleteReason?: string;
  labelOptions?: LabelOption[];
  canManageLabels?: boolean;
  feedInitialPage?: FeedPage;
  canComment?: boolean;
  commentPostReason?: string | null;
  viewer?: Viewer | null;
  feedFilter?: FeedFilterValue;
}) {
  return (
    <div className="flex gap-6 p-4">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <CopyableKey issueKey={issue.key} />
        <h1 className="text-h4">
          <EditableText
            label="Title"
            field="title"
            issueId={issue.id}
            value={issue.title}
            maxLength={200}
            canWrite={canWrite}
            writeReason={writeReason}
            updateIssueAction={updateIssue}
          />
        </h1>
        <EditableText
          label="Description"
          field="description"
          issueId={issue.id}
          value={issue.description ?? ""}
          multiline
          maxLength={10000}
          renderMarkdown
          canWrite={canWrite}
          writeReason={writeReason}
          updateIssueAction={updateIssue}
        />
        {viewer ? (
          <Suspense fallback={<FeedSkeleton />}>
            <Feed
              target={{ issueId: issue.id }}
              initialPage={feedInitialPage}
              canPost={canComment}
              postReason={commentPostReason}
              viewer={viewer}
              feedFilter={feedFilter}
            />
          </Suspense>
        ) : null}
      </div>
      <aside
        aria-label="Issue details"
        className="flex w-[262px] shrink-0 flex-col gap-4">
        <IssueRail
          issueId={issue.id}
          column={issue.column}
          priority={issue.priority}
          assignee={issue.assignee}
          dueDate={issue.dueDate}
          columns={columns}
          assigneePool={assigneePool}
          canWrite={canWrite}
          writeReason={writeReason}
          updateIssueAction={updateIssue}
          labelOptions={labelOptions}
          canManageLabels={canManageLabels}
          addIssueLabelAction={addIssueLabel}
          removeIssueLabelAction={removeIssueLabel}
        />
        <DeleteIssueControl
          issueId={issue.id}
          issueKey={issue.key}
          issueTitle={issue.title}
          projectKey={issue.project.key}
          canDelete={canDelete}
          deleteReason={deleteReason}
          deleteIssueAction={deleteIssue}
        />
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