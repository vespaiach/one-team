import { forbidden, notFound } from "next/navigation";
import { Suspense } from "react";
import { requireActor } from "@/features/auth/server/actor";
import { createIssue } from "@/features/issues/actions";
import { CreateIssueForm } from "@/features/issues/components/create-issue-form";
import { CreateIssueFormSkeleton } from "@/features/issues/components/issue-skeletons";
import { listAssigneePool, listProjectColumns } from "@/features/issues/server/issue-queries";
import { isMember } from "@/features/projects/server/authorization";
import { loadProjectByKey } from "@/features/projects/server/queries";
import { ScreenHeader } from "@/features/shell/components/screen-header";

async function CreateIssueFormData({ projectId, projectKey }: { projectId: string; projectKey: string }) {
  const [columns, assigneePool] = await Promise.all([
    listProjectColumns(projectId),
    listAssigneePool(projectId),
  ]);

  return (
    <CreateIssueForm
      projectId={projectId}
      projectKey={projectKey}
      columns={columns}
      assigneePool={assigneePool}
      createIssueAction={createIssue}
    />
  );
}

export default async function NewIssuePage({ params }: { params: Promise<{ projectKey: string }> }) {
  const actor = await requireActor();
  const { projectKey } = await params;

  const project = await loadProjectByKey(projectKey);
  if (!project) {
    notFound();
  }

  if (!(await isMember(actor, project.id))) {
    forbidden();
  }

  return (
    <>
      <ScreenHeader name="New issue" />
      <Suspense fallback={<CreateIssueFormSkeleton />}>
        <CreateIssueFormData
          projectId={project.id}
          projectKey={project.key}
        />
      </Suspense>
    </>
  );
}