import { loadActor } from "@/features/auth/server/actor";
import { AppShell } from "@/features/shell/components/app-shell";
import { MessageHost } from "@/features/shell/components/message-host";
import { displayName } from "@/lib/display-name";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await loadActor();
  if (!actor) {
    return children;
  }
  return (
    <>
      <AppShell
        displayName={displayName(actor)}
        avatarUrl={actor.avatarUrl}
        isAdmin={actor.role === "admin"}
        showPasswordBanner={actor.mustChangePassword}>
        {children}
      </AppShell>
      <MessageHost />
    </>
  );
}