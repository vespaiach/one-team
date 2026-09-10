import Link from "next/link";
import Logo from "@/app/components/common/logo";
import type { ProjectListRegionEntry } from "./project-list-region";
import { ProjectListRegion } from "./project-list-region";
import { UserChip } from "./user-chip";

const NAV_LINK_CLASSES =
  "flex items-center gap-2.5 px-2 py-1.5 text-control text-(--color-text) hover:bg-(--color-surface)";
const GROUP_LABEL_CLASSES =
  "px-2 pt-1 pb-0.5 text-caption tracking-[0.08em] text-(--color-text-muted) uppercase";
const GROUP_CLASSES = "flex flex-col gap-0.5 px-2.5 py-2";

function HomeIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="flex-none">
      <path
        d="M3.6 10.4 12 3.7l8.4 6.7v10H3.6z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M9.6 20.4v-5.3h4.8v5.3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="flex-none">
      <path
        d="M12 3.4a6.2 6.2 0 0 1 6.2 6.2c0 3.7.9 5.3 1.6 6.2a.6.6 0 0 1-.5 1H4.7a.6.6 0 0 1-.5-1c.7-.9 1.6-2.5 1.6-6.2A6.2 6.2 0 0 1 12 3.4Z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M9.4 19.4a2.8 2.8 0 0 0 5.2 0"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function AccountsIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="flex-none">
      <circle
        cx="9.5"
        cy="8.2"
        r="3.4"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M3.4 19.6c0-3.2 2.7-5.4 6.1-5.4s6.1 2.2 6.1 5.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M16.4 5.6a3.1 3.1 0 0 1 0 5.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M18.2 14.7c2 .7 3.4 2.4 3.4 4.6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LabelsIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="flex-none">
      <path
        d="M11.6 3.4H20a.6.6 0 0 1 .6.6v8.4l-8.7 8.6a1 1 0 0 1-1.4 0l-7.5-7.5a1 1 0 0 1 0-1.4z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle
        cx="16.6"
        cy="7.4"
        r="1.4"
        fill="currentColor"
      />
    </svg>
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
      <div className="border-b-2 border-(--color-border) px-4.5 pb-4">
        <Logo />
      </div>
      {/* biome-ignore lint/a11y/useSemanticElements: fieldset carries form semantics that don't apply to a nav grouping */}
      <div
        role="group"
        aria-labelledby="sidebar-work-label"
        className={GROUP_CLASSES}>
        <span
          id="sidebar-work-label"
          className={GROUP_LABEL_CLASSES}>
          Work
        </span>
        <Link
          href="/home"
          className={NAV_LINK_CLASSES}>
          <HomeIcon />
          Home
        </Link>
        <Link
          href="/notifications"
          aria-label={
            unreadNotificationCount > 0 ? `Notifications, ${unreadNotificationCount} unread` : undefined
          }
          className={NAV_LINK_CLASSES}>
          <BellIcon />
          Notifications
          {unreadNotificationCount > 0 ? (
            <span
              aria-hidden="true"
              className="ms-auto font-mono">
              {unreadNotificationCount}
            </span>
          ) : null}
        </Link>
      </div>
      <ProjectListRegion
        isAdmin={isAdmin}
        entries={projects}
      />
      {isAdmin ? (
        // biome-ignore lint/a11y/useSemanticElements: fieldset carries form semantics that don't apply to a nav grouping
        <div
          role="group"
          aria-labelledby="sidebar-admin-label"
          className={`${GROUP_CLASSES} mt-2 border-t-2 border-(--color-border) pt-3`}>
          <span
            id="sidebar-admin-label"
            className={GROUP_LABEL_CLASSES}>
            Admin
          </span>
          <Link
            href="/settings/accounts"
            className={NAV_LINK_CLASSES}>
            <AccountsIcon />
            Accounts
          </Link>
          <Link
            href="/settings/labels"
            className={NAV_LINK_CLASSES}>
            <LabelsIcon />
            Labels
          </Link>
        </div>
      ) : null}
      <UserChip
        displayName={displayName}
        avatarUrl={avatarUrl}
      />
    </nav>
  );
}