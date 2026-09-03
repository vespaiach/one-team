import { notFound } from "next/navigation";
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

  let admin: ProjectDetailsScreenAdmin | undefined;
  if (details.canAdminister) {
    const projectRow = await loadProjectByKey(projectKey);
    if (projectRow) {
      admin = {
        candidates: await listAddableUsers({ excludeProjectId: projectRow.id }),
        addProjectMemberAction: addProjectMember,
        removeProjectMemberAction: removeProjectMember,
        setProjectStatusAction: setProjectStatus,
        deleteProjectAction: deleteProject,
      };
    }
  }

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
    />
  );
}