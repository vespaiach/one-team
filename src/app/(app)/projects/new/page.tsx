import { forbidden } from "next/navigation";
import { requireActor } from "@/features/auth/server/actor";
import { checkProjectKeyAvailable, createProject } from "@/features/projects/actions";
import { CreateProjectForm } from "@/features/projects/components/create-project-form";
import { listAddableUsers } from "@/features/projects/server/queries";
import { ScreenHeader } from "@/features/shell/components/screen-header";

export default async function NewProjectPage() {
  const actor = await requireActor();
  if (actor.role !== "admin") {
    forbidden();
  }

  const candidates = await listAddableUsers({ excludeUserId: actor.id });

  return (
    <>
      <ScreenHeader name="New project" />
      <CreateProjectForm
        createProjectAction={createProject}
        checkKeyAvailability={checkProjectKeyAvailable}
        candidates={candidates}
      />
    </>
  );
}