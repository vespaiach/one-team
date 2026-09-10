import { countActiveUsers, countUsers } from "@/features/accounts/server/roster";
import { loadActor } from "@/features/auth/server/actor";
import { listAssignedIssues } from "@/features/home/server/assigned-queries";
import { countOpenIssuesForTeam } from "@/features/home/server/metrics-queries";
import { countLabels } from "@/features/labels/server/queries";
import { countUnreadNotifications } from "@/features/notifications/server/notification-queries";
import { checkProjectKeyAvailable, createProject } from "@/features/projects/actions";
import { listAddableUsers, listProjectsForSidebar } from "@/features/projects/server/queries";
import { AppShell } from "@/features/shell/components/app-shell";
import { ToastRegion } from "@/features/shell/components/toast-region";
import { displayName } from "@/lib/display-name";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await loadActor();
  if (!actor) {
    return children;
  }

  const isAdmin = actor.role === "admin";
  const [
    projects,
    openIssues,
    assignedIssues,
    unreadNotifications,
    activeMemberCount,
    accounts,
    labels,
    projectCandidates,
  ] = await Promise.all([
    listProjectsForSidebar(),
    countOpenIssuesForTeam(),
    listAssignedIssues(actor.id),
    countUnreadNotifications(actor.id),
    countActiveUsers(),
    isAdmin ? countUsers() : Promise.resolve(0),
    isAdmin ? countLabels() : Promise.resolve(0),
    isAdmin ? listAddableUsers({ excludeUserId: actor.id }) : Promise.resolve([]),
  ]);

  return (
    <>
      <AppShell
        displayName={displayName(actor)}
        avatarUrl={actor.avatarUrl}
        isAdmin={isAdmin}
        showPasswordBanner={actor.mustChangePassword}
        projects={projects}
        activeMemberCount={activeMemberCount}
        workCounts={{
          openIssues,
          assignedToMe: assignedIssues.length,
          unreadNotifications,
        }}
        adminCounts={isAdmin ? { accounts, labels } : null}
        createProjectAction={createProject}
        checkKeyAvailability={checkProjectKeyAvailable}
        projectCandidates={projectCandidates}>
        {children}
      </AppShell>
      <ToastRegion />
    </>
  );
}