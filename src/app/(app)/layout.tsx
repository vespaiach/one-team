import { loadActor } from "@/features/auth/server/actor";
import { AppShell } from "@/features/shell/components/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await loadActor();
  if (!actor) {
    return children;
  }
  return <AppShell>{children}</AppShell>;
}