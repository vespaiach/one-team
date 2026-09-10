import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireActor } from "@/features/auth/server/actor";
import { IssueDetail } from "@/features/issues/components/issue-detail";
import { IssueDetailSkeleton } from "@/features/issues/components/issue-skeletons";
import { NewIssueModal } from "@/features/issues/components/new-issue-modal";
import {
  listAssigneePool,
  listProjectColumns,
  loadIssueDetailData,
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

  const data = await loadIssueDetailData(projectKey, number, actor);
  if (!data) {
    notFound();
  }

  const project = await loadProjectByKey(projectKey);
  if (!project) {
    notFound();
  }
  const createAccess = await resolveIssueWriteAccess(actor, project, "create");
  const [columns, assigneePool, labelOptions] = await Promise.all([
    listProjectColumns(project.id),
    listAssigneePool(project.id),
    listLabelOptionsForIssue(),
  ]);

  return (
    <>
      <ScreenHeader
        name={project.name}
        newIssue={
          <NewIssueModal
            projectId={project.id}
            projectKey={project.key}
            columns={columns}
            assigneePool={assigneePool}
            labelOptions={labelOptions}
            canManageLabels={actor.role === "admin"}
            canWrite={createAccess.canWrite}
            writeReason={createAccess.writeReason}
          />
        }
      />
      <Suspense fallback={<IssueDetailSkeleton />}>
        <IssueDetail {...data} />
      </Suspense>
    </>
  );
}