import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireActor } from "@/features/auth/server/actor";
import { IssueDetail } from "@/features/issues/components/issue-detail";
import { IssueDetailSkeleton } from "@/features/issues/components/issue-skeletons";
import { listAssigneePool, listProjectColumns, loadIssueView } from "@/features/issues/server/issue-queries";
import { loadProjectByKey } from "@/features/projects/server/queries";

export default async function IssueDetailsPage({
  params,
}: {
  params: Promise<{ projectKey: string; issueNumber: string }>;
}) {
  await requireActor();
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

  const [columns, assigneePool] = await Promise.all([
    listProjectColumns(project.id),
    listAssigneePool(project.id),
  ]);

  return (
    <Suspense fallback={<IssueDetailSkeleton />}>
      <IssueDetail
        issue={issue}
        columns={columns}
        assigneePool={assigneePool}
      />
    </Suspense>
  );
}