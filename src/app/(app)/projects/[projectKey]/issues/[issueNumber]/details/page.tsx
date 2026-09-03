import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireActor } from "@/features/auth/server/actor";
import { IssueDetail } from "@/features/issues/components/issue-detail";
import { IssueDetailSkeleton } from "@/features/issues/components/issue-skeletons";
import { loadIssueView } from "@/features/issues/server/issue-queries";

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

  return (
    <Suspense fallback={<IssueDetailSkeleton />}>
      <IssueDetail issue={issue} />
    </Suspense>
  );
}