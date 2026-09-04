import { notFound } from "next/navigation";
import { getFeedFilter } from "@/features/activity/server/feed-filter";
import { countProjectComments, listFeed } from "@/features/activity/server/feed-queries";
import { requireActor } from "@/features/auth/server/actor";
import { NewIssueControl } from "@/features/issues/components/new-issue-control";
import { buildIssueWriteReason } from "@/features/issues/server/issue-queries";
import {
  addProjectMember,
  deleteProject,
  removeProjectMember,
  setProjectStatus,
  updateProject,
} from "@/features/projects/actions";
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

  return (
    <ProjectDetailsScreen
      details={details}
      updateProjectAction={updateProject}
      admin={admin}
      newIssue={
        <NewIssueControl
          projectKey={details.record.key}
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