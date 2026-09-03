import type { ReactNode } from "react";
import { MustChangePasswordBanner } from "@/features/auth/components/must-change-password-banner";
import { ConnectionBanner } from "./connection-banner";
import type { ProjectListRegionEntry } from "./project-list-region";
import { Sidebar } from "./sidebar";

export function AppShell({
  displayName,
  avatarUrl,
  isAdmin,
  showPasswordBanner,
  projects = [],
  children,
}: {
  displayName: string;
  avatarUrl: string | null;
  isAdmin: boolean;
  showPasswordBanner: boolean;
  projects?: ProjectListRegionEntry[];
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-[1280px] flex-1">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-10 focus:bg-(--color-bg) focus:px-3 focus:py-2 focus:text-(--color-text)">
        Skip to content
      </a>
      <Sidebar
        displayName={displayName}
        avatarUrl={avatarUrl}
        isAdmin={isAdmin}
        projects={projects}
      />
      <main
        id="main-content"
        className="flex flex-1 flex-col bg-(--color-surface)">
        {showPasswordBanner ? <MustChangePasswordBanner /> : null}
        <ConnectionBanner />
        {children}
      </main>
    </div>
  );
}