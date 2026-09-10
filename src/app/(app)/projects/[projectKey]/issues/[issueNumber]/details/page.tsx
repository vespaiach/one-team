import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireActor } from "@/features/auth/server/actor";
import { IssueDetail } from "@/features/issues/components/issue-detail";
import { IssueDetailSkeleton } from "@/features/issues/components/issue-skeletons";
import { NewIssueControl } from "@/features/issues/components/new-issue-control";
import { loadIssueDetailData, resolveIssueWriteAccess } from "@/features/issues/server/issue-queries";
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
        <IssueDetail {...data} />
      </Suspense>
    </>
  );
}