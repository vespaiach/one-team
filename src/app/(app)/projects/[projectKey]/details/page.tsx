import { notFound } from "next/navigation";
import { requireActor } from "@/features/auth/server/actor";
import { updateProject } from "@/features/projects/actions";
import { ProjectDetailsScreen } from "@/features/projects/components/project-details-screen";
import { loadProjectDetails } from "@/features/projects/server/queries";

export default async function ProjectDetailsPage({ params }: { params: Promise<{ projectKey: string }> }) {
  const actor = await requireActor();
  const { projectKey } = await params;

  const details = await loadProjectDetails(projectKey, actor);
  if (!details) {
    notFound();
  }

  return (
    <ProjectDetailsScreen
      details={details}
      updateProjectAction={updateProject}
    />
  );
}