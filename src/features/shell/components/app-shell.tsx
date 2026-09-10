import type { ReactNode } from "react";
import { MustChangePasswordBanner } from "@/features/auth/components/must-change-password-banner";
import type { RailAdminCounts, RailWorkCounts } from "../rail-types";
import { ConnectionBanner } from "./connection-banner";
import type { ProjectListRegionEntry } from "./project-list-region";
import { Sidebar } from "./sidebar";

export function AppShell({
  displayName,
  avatarUrl,
  isAdmin,
  showPasswordBanner,
  projects = [],
  activeMemberCount,
  workCounts,
  adminCounts,
  children,
}: {
  displayName: string;
  avatarUrl: string | null;
  isAdmin: boolean;
  showPasswordBanner: boolean;
  projects?: ProjectListRegionEntry[];
  activeMemberCount: number;
  workCounts: RailWorkCounts;
  adminCounts: RailAdminCounts | null;
  children: ReactNode;
}) {
  return (
    <div className="flex h-screen min-w-[1280px] overflow-hidden font-sans text-[13px] text-(--color-text) leading-[1.35]">
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
        activeMemberCount={activeMemberCount}
        workCounts={workCounts}
        adminCounts={adminCounts}
      />
      <main
        id="main-content"
        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-(--color-bg)">
        {showPasswordBanner ? <MustChangePasswordBanner /> : null}
        <ConnectionBanner />
        {children}
      </main>
    </div>
  );
}