import Link from "next/link";
import Logo from "@/app/components/common/logo";
import type { ProjectListRegionEntry } from "./project-list-region";
import { ProjectListRegion } from "./project-list-region";
import { UserChip } from "./user-chip";

const NAV_LINK_CLASSES = "px-4.5 py-1.5 text-control text-(--color-text) hover:bg-(--color-surface)";

function NavGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="px-4.5 py-1.5 text-label text-(--color-text-muted)">{label}</span>
      {children}
    </div>
  );
}

export function Sidebar({
  displayName,
  avatarUrl,
  isAdmin,
  projects = [],
  unreadNotificationCount = 0,
}: {
  displayName: string;
  avatarUrl: string | null;
  isAdmin: boolean;
  projects?: ProjectListRegionEntry[];
  unreadNotificationCount?: number;
}) {
  return (
    <nav
      aria-label="Primary navigation"
      className="sticky start-0 flex w-[262px] shrink-0 flex-col self-stretch border-e-2 border-(--color-border) bg-(--color-bg) py-4">
      <div className="px-4.5 pb-4">
        <Logo />
      </div>
      <NavGroup label="Work">
        <Link
          href="/home"
          className={NAV_LINK_CLASSES}>
          Home
        </Link>
        <Link
          href="/notifications"
          aria-label={
            unreadNotificationCount > 0 ? `Notifications, ${unreadNotificationCount} unread` : undefined
          }
          className={NAV_LINK_CLASSES}>
          Notifications
          {unreadNotificationCount > 0 ? (
            <span
              aria-hidden="true"
              className="ms-2">
              {unreadNotificationCount}
            </span>
          ) : null}
        </Link>
      </NavGroup>
      <ProjectListRegion
        isAdmin={isAdmin}
        entries={projects}
      />
      {isAdmin ? (
        <NavGroup label="Admin">
          <Link
            href="/settings/accounts"
            className={NAV_LINK_CLASSES}>
            Accounts
          </Link>
          <Link
            href="/settings/labels"
            className={NAV_LINK_CLASSES}>
            Labels
          </Link>
        </NavGroup>
      ) : null}
      <UserChip
        displayName={displayName}
        avatarUrl={avatarUrl}
      />
    </nav>
  );
}