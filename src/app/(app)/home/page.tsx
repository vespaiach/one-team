import { Suspense } from "react";
import { requireActor } from "@/features/auth/server/actor";
import { ActivitySection } from "@/features/home/components/activity-section";
import { ActivitySectionSkeleton } from "@/features/home/components/activity-section-skeleton";
import { AssignedListSkeleton } from "@/features/home/components/assigned-list-skeleton";
import { AssignedSection } from "@/features/home/components/assigned-section";
import { HomeHeader } from "@/features/home/components/home-header";
import { MetricStripSection } from "@/features/home/components/metric-strip-section";
import { MetricStripSkeleton } from "@/features/home/components/metric-strip-skeleton";
import { NewWorkspaceState } from "@/features/home/components/new-workspace-state";
import { ProjectsSection } from "@/features/home/components/projects-section";
import { ProjectsSectionSkeleton } from "@/features/home/components/projects-section-skeleton";
import { countOpenIssuesForTeam } from "@/features/home/server/metrics-queries";
import { hasAnyProject } from "@/features/home/server/project-queries";
import { checkProjectKeyAvailable, createProject } from "@/features/projects/actions";
import { CreateProjectModal } from "@/features/projects/components/create-project-modal";
import { listAddableUsers, listProjectsForSidebar } from "@/features/projects/server/queries";

export default async function HomePage() {
  const actor = await requireActor();
  const isAdmin = actor.role === "admin";
  const now = new Date();

  if (!(await hasAnyProject())) {
    const candidates = isAdmin ? await listAddableUsers({ excludeUserId: actor.id }) : [];
    return (
      <div className="flex min-h-full flex-col">
        <HomeHeader
          firstName={actor.firstName}
          now={now}
        />
        <NewWorkspaceState
          isAdmin={isAdmin}
          createProjectModal={
            isAdmin ? (
              <CreateProjectModal
                createProjectAction={createProject}
                checkKeyAvailability={checkProjectKeyAvailable}
                candidates={candidates}
              />
            ) : null
          }
        />
      </div>
    );
  }

  const [projects, totalOpenCount] = await Promise.all([listProjectsForSidebar(), countOpenIssuesForTeam()]);

  return (
    <div className="flex h-full flex-col">
      <HomeHeader
        firstName={actor.firstName}
        now={now}
      />
      <Suspense fallback={<MetricStripSkeleton />}>
        <MetricStripSection userId={actor.id} />
      </Suspense>
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_372px]">
        <div className="min-w-0 overflow-y-auto">
          <Suspense fallback={<AssignedListSkeleton />}>
            <AssignedSection
              userId={actor.id}
              projects={projects}
              totalOpenCount={totalOpenCount}
            />
          </Suspense>
        </div>
        <div className="min-w-0 overflow-y-auto border-(--color-divider) border-l">
          <Suspense fallback={<ProjectsSectionSkeleton />}>
            <ProjectsSection userId={actor.id} />
          </Suspense>
          <Suspense fallback={<ActivitySectionSkeleton />}>
            <ActivitySection />
          </Suspense>
        </div>
      </div>
    </div>
  );
}