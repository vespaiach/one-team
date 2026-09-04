import { notFound } from "next/navigation";
import { Suspense } from "react";
import { listFeed } from "@/features/activity/server/feed-queries";
import { requireActor } from "@/features/auth/server/actor";
import { IssueDetail } from "@/features/issues/components/issue-detail";
import { IssueDetailSkeleton } from "@/features/issues/components/issue-skeletons";
import { NewIssueControl } from "@/features/issues/components/new-issue-control";
import {
  listAssigneePool,
  listProjectColumns,
  loadIssueView,
  resolveIssueDeleteAccess,
  resolveIssueWriteAccess,
} from "@/features/issues/server/issue-queries";
import { listLabelOptionsForIssue } from "@/features/labels/server/queries";
import { loadProjectByKey } from "@/features/projects/server/queries";
import { ScreenHeader } from "@/features/shell/components/screen-header";

export default async function IssueDetailsPage({
  params,
}: {
  params: Promise<{ projectKey: string; issueNumber: string }>;
}) {
  const actor = await requireActor();
  const { projectKey, issueNumber } = await params;

  const number = Number(issueNumber);
  if (!Number.isInteger(number) || number <= 0) {
    notFound();
  }

  const issue = await loadIssueView(projectKey, number);
  if (!issue) {
    notFound();
  }

  const project = await loadProjectByKey(projectKey);
  if (!project) {
    notFound();
  }

  const [columns, assigneePool, writeAccess, createAccess, labelOptions, feedInitialPage] = await Promise.all(
    [
      listProjectColumns(project.id),
      listAssigneePool(project.id),
      resolveIssueWriteAccess(actor, project, "edit"),
      resolveIssueWriteAccess(actor, project, "create"),
      listLabelOptionsForIssue(issue.id),
      listFeed({ issueId: issue.id }, { id: actor.id, isAdmin: actor.role === "admin" }),
    ],
  );
  const deleteAccess = resolveIssueDeleteAccess(actor, project);
  const commentPostReason = writeAccess.canWrite
    ? null
    : `Only project members can comment in ${project.name}.`;

  return (
    <>
      <ScreenHeader
        name={project.name}
        newIssue={
          <NewIssueControl
            projectKey={project.key}
            canWrite={createAccess.canWrite}
            writeReason={createAccess.writeReason}
          />
        }
      />
      <Suspense fallback={<IssueDetailSkeleton />}>
        <IssueDetail
          issue={issue}
          columns={columns}
          assigneePool={assigneePool}
          canWrite={writeAccess.canWrite}
          writeReason={writeAccess.writeReason}
          canDelete={deleteAccess.canDelete}
          deleteReason={deleteAccess.deleteReason}
          labelOptions={labelOptions}
          canManageLabels={actor.role === "admin"}
          feedInitialPage={feedInitialPage}
          canComment={writeAccess.canWrite}
          commentPostReason={commentPostReason}
          viewer={{
            id: actor.id,
            firstName: actor.firstName,
            lastName: actor.lastName,
            avatarUrl: actor.avatarUrl,
          }}
        />
      </Suspense>
    </>
  );
}