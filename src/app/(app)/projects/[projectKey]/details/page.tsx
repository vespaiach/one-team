import { notFound } from "next/navigation";
import { getFeedFilter } from "@/features/activity/server/feed-filter";
import { countProjectComments, listFeed } from "@/features/activity/server/feed-queries";
import { requireActor } from "@/features/auth/server/actor";
import { NewIssueModal } from "@/features/issues/components/new-issue-modal";
import {
  buildIssueWriteReason,
  listAssigneePool,
  listProjectColumns,
} from "@/features/issues/server/issue-queries";
import { listLabelOptionsForIssue } from "@/features/labels/server/queries";
import {
  addProjectMember,
  deleteProject,
  removeProjectMember,
  setProjectStatus,
  updateProject,
} from "@/features/projects/actions";
import { createColumn, deleteColumn, moveColumn, updateColumn } from "@/features/projects/column-actions";
import type { ProjectDetailsScreenAdmin } from "@/features/projects/components/project-details-screen";
import { ProjectDetailsScreen } from "@/features/projects/components/project-details-screen";
import { listAddableUsers, loadProjectByKey, loadProjectDetails } from "@/features/projects/server/queries";

export default async function ProjectDetailsPage({ params }: { params: Promise<{ projectKey: string }> }) {
  const actor = await requireActor();
  const { projectKey } = await params;

  const details = await loadProjectDetails(projectKey, actor);
  if (!details) {
    notFound();
  }

  const projectRow = await loadProjectByKey(projectKey);
  if (!projectRow) {
    notFound();
  }

  let admin: ProjectDetailsScreenAdmin | undefined;
  if (details.canAdminister) {
    admin = {
      candidates: await listAddableUsers({ excludeProjectId: projectRow.id }),
      addProjectMemberAction: addProjectMember,
      removeProjectMemberAction: removeProjectMember,
      setProjectStatusAction: setProjectStatus,
      deleteProjectAction: deleteProject,
      createColumn,
      updateColumn,
      moveColumn,
      deleteColumn,
    };
  }

  const feedInitialPage = await listFeed(
    { projectId: projectRow.id },
    { id: actor.id, isAdmin: actor.role === "admin" },
  );
  const feedFilter = await getFeedFilter(actor.id);
  const commentCount = await countProjectComments(projectRow.id);
  const commentPostReason = details.canEditRecord
    ? null
    : `Only project members can comment in ${details.record.name}.`;

  const [columns, assigneePool, labelOptions] = await Promise.all([
    listProjectColumns(projectRow.id),
    listAssigneePool(projectRow.id),
    listLabelOptionsForIssue(),
  ]);

  return (
    <ProjectDetailsScreen
      details={details}
      updateProjectAction={updateProject}
      admin={admin}
      newIssue={
        <NewIssueModal
          projectId={projectRow.id}
          projectKey={details.record.key}
          columns={columns}
          assigneePool={assigneePool}
          labelOptions={labelOptions}
          canManageLabels={actor.role === "admin"}
          canWrite={details.canEditRecord}
          writeReason={details.canEditRecord ? "" : buildIssueWriteReason("create", details.record.name)}
        />
      }
      feedProjectId={projectRow.id}
      feedInitialPage={feedInitialPage}
      feedFilter={feedFilter}
      commentCount={commentCount}
      canComment={details.canEditRecord}
      commentPostReason={commentPostReason}
      viewer={{
        id: actor.id,
        firstName: actor.firstName,
        lastName: actor.lastName,
        avatarUrl: actor.avatarUrl,
      }}
    />
  );
}