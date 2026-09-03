import Link from "next/link";
import Logo from "@/app/components/common/logo";
import type { ProjectListRegionEntry } from "./project-list-region";
import { ProjectListRegion } from "./project-list-region";
import { UserChip } from "./user-chip";

const NAV_LINK_CLASSES = "px-4.5 py-1.5 text-control text-(--color-text) hover:bg-(--color-surface)";

export function Sidebar({
  displayName,
  avatarUrl,
  isAdmin,
  projects = [],
}: {
  displayName: string;
  avatarUrl: string | null;
  isAdmin: boolean;
  projects?: ProjectListRegionEntry[];
}) {
  return (
    <nav
      aria-label="Primary navigation"
      className="sticky start-0 flex w-[262px] shrink-0 flex-col self-stretch border-e-2 border-(--color-border) bg-(--color-bg) py-4">
      <div className="px-4.5 pb-4">
        <Logo />
      </div>
      <Link
        href="/home"
        className={NAV_LINK_CLASSES}>
        Home
      </Link>
      <ProjectListRegion
        isAdmin={isAdmin}
        entries={projects}
      />
      <Link
        href="/notifications"
        className={NAV_LINK_CLASSES}>
        Notifications
      </Link>
      {isAdmin ? (
        <Link
          href="/settings/accounts"
          className={NAV_LINK_CLASSES}>
          Accounts
        </Link>
      ) : null}
      {isAdmin ? (
        <Link
          href="/settings/labels"
          className={NAV_LINK_CLASSES}>
          Labels
        </Link>
      ) : null}
      <UserChip
        displayName={displayName}
        avatarUrl={avatarUrl}
      />
    </nav>
  );
}