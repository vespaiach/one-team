import { Suspense } from "react";
import { requireActor } from "@/features/auth/server/actor";
import { ActivitySection } from "@/features/home/components/activity-section";
import { ActivitySkeleton } from "@/features/home/components/activity-skeleton";
import { AssignedSection } from "@/features/home/components/assigned-section";
import { AssignedSkeleton } from "@/features/home/components/assigned-skeleton";
import { MentionsSection } from "@/features/home/components/mentions-section";
import { MentionsSkeleton } from "@/features/home/components/mentions-skeleton";
import { ProjectsSection } from "@/features/home/components/projects-section";
import { ProjectsSkeleton } from "@/features/home/components/projects-skeleton";
import { StatCards } from "@/features/home/components/stat-cards";
import { StatCardsSkeleton } from "@/features/home/components/stat-cards-skeleton";
import { NewIssueProjectPicker } from "@/features/issues/components/new-issue-project-picker";
import { checkProjectKeyAvailable, createProject } from "@/features/projects/actions";
import { CreateProjectModal } from "@/features/projects/components/create-project-modal";
import { listAddableUsers, listProjectsForSidebar } from "@/features/projects/server/queries";
import { CommandPaletteTrigger } from "@/features/shell/components/command-palette-trigger";
import { displayName } from "@/lib/display-name";

export default async function HomePage() {
  const actor = await requireActor();
  const isAdmin = actor.role === "admin";
  const projects = await listProjectsForSidebar();
  const candidates = isAdmin ? await listAddableUsers({ excludeUserId: actor.id }) : [];

  return (
    <div className="flex flex-col gap-6 py-4.5">
      <div className="flex items-center justify-between gap-3 px-4.5">
        <p className="text-h5">{displayName(actor)}</p>
        <div className="flex items-center gap-4">
          <CommandPaletteTrigger />
          <NewIssueProjectPicker projects={projects} />
          {isAdmin ? (
            <CreateProjectModal
              createProjectAction={createProject}
              checkKeyAvailability={checkProjectKeyAvailable}
              candidates={candidates}
            />
          ) : null}
        </div>
      </div>
      <Suspense fallback={<StatCardsSkeleton />}>
        <StatCards userId={actor.id} />
      </Suspense>
      <Suspense fallback={<AssignedSkeleton />}>
        <AssignedSection userId={actor.id} />
      </Suspense>
      <Suspense fallback={<ProjectsSkeleton />}>
        <ProjectsSection userId={actor.id} />
      </Suspense>
      <Suspense fallback={<MentionsSkeleton />}>
        <MentionsSection userId={actor.id} />
      </Suspense>
      <Suspense fallback={<ActivitySkeleton />}>
        <ActivitySection />
      </Suspense>
    </div>
  );
}