import { forbidden, notFound } from "next/navigation";
import { Suspense } from "react";
import { requireActor } from "@/features/auth/server/actor";
import { createIssue } from "@/features/issues/actions";
import { CreateIssueForm } from "@/features/issues/components/create-issue-form";
import { CreateIssueFormSkeleton } from "@/features/issues/components/issue-skeletons";
import { NewIssueControl } from "@/features/issues/components/new-issue-control";
import { type IssuePriority, parsePriority, parseTitle } from "@/features/issues/server/input";
import { listAssigneePool, listProjectColumns } from "@/features/issues/server/issue-queries";
import { listLabelOptionsForIssue } from "@/features/labels/server/queries";
import { isMember } from "@/features/projects/server/authorization";
import { loadProjectByKey } from "@/features/projects/server/queries";
import { ScreenHeader } from "@/features/shell/components/screen-header";

type NewIssuePreselection = {
  title: string | null;
  columnId: string | null;
  assigneeId: string | null;
  priority: IssuePriority | null;
};

function parseSingleValue(value: string | string[] | undefined): string | null {
  return typeof value === "string" ? value : null;
}

async function CreateIssueFormData({
  projectId,
  projectKey,
  canManageLabels,
  preselection,
}: {
  projectId: string;
  projectKey: string;
  canManageLabels: boolean;
  preselection: NewIssuePreselection;
}) {
  const [columns, assigneePool, labelOptions] = await Promise.all([
    listProjectColumns(projectId),
    listAssigneePool(projectId),
    listLabelOptionsForIssue(),
  ]);

  return (
    <CreateIssueForm
      projectId={projectId}
      projectKey={projectKey}
      columns={columns}
      assigneePool={assigneePool}
      createIssueAction={createIssue}
      labelOptions={labelOptions}
      canManageLabels={canManageLabels}
      initialTitle={preselection.title ?? undefined}
      initialColumnId={columns.find((column) => column.id === preselection.columnId)?.id}
      initialAssigneeId={assigneePool.find((assignee) => assignee.id === preselection.assigneeId)?.id}
      initialPriority={preselection.priority ?? undefined}
    />
  );
}

export default async function NewIssuePage({
  params,
  searchParams,
}: {
  params: Promise<{ projectKey: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireActor();
  const { projectKey } = await params;

  const project = await loadProjectByKey(projectKey);
  if (!project) {
    notFound();
  }

  if (!(await isMember(actor, project.id))) {
    forbidden();
  }

  const query = (await searchParams) ?? {};
  const preselection: NewIssuePreselection = {
    title: parseTitle(query.title),
    columnId: parseSingleValue(query.columnId),
    assigneeId: parseSingleValue(query.assigneeId),
    priority: parsePriority(query.priority),
  };

  return (
    <>
      <ScreenHeader
        name="New issue"
        newIssue={
          <NewIssueControl
            projectKey={project.key}
            canWrite={true}
            writeReason=""
          />
        }
      />
      <Suspense fallback={<CreateIssueFormSkeleton />}>
        <CreateIssueFormData
          projectId={project.id}
          projectKey={project.key}
          canManageLabels={actor.role === "admin"}
          preselection={preselection}
        />
      </Suspense>
    </>
  );
}