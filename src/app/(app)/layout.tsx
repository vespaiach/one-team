import { loadActor } from "@/features/auth/server/actor";
import { listProjectsForSidebar } from "@/features/projects/server/queries";
import { AppShell } from "@/features/shell/components/app-shell";
import { ToastRegion } from "@/features/shell/components/toast-region";
import { displayName } from "@/lib/display-name";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await loadActor();
  if (!actor) {
    return children;
  }
  const projects = await listProjectsForSidebar();
  return (
    <>
      <AppShell
        displayName={displayName(actor)}
        avatarUrl={actor.avatarUrl}
        isAdmin={actor.role === "admin"}
        showPasswordBanner={actor.mustChangePassword}
        projects={projects}>
        {children}
      </AppShell>
      <ToastRegion />
    </>
  );
}