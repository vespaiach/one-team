"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import type { CreateProjectPayload, CreateProjectState } from "@/features/projects/actions";
import type { RosterEntry } from "@/features/projects/server/queries";
import type { RailAdminCounts, RailWorkCounts } from "../rail-types";
import type { ProjectListRegionEntry } from "./project-list-region";
import { ProjectListRegion } from "./project-list-region";
import { UserChip } from "./user-chip";

const GROUP_LABEL_CLASSES =
  "flex h-[22px] items-center gap-1.5 px-[7px] text-[10px] font-medium text-(--color-text-muted) uppercase tracking-[0.11em]";
const RAIL_ITEM_CLASSES =
  "flex h-(--size-row) items-center gap-2 rounded-sm px-[7px] text-[13px] whitespace-nowrap no-underline hover:bg-(--color-chrome-tint-strong)";
const RAIL_ITEM_CURRENT_CLASSES = "bg-(--color-accent-100) font-medium text-(--color-accent-800)";

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

function AllWorkIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="flex-none">
      <rect
        x="3.4"
        y="3.6"
        width="6.2"
        height="12.4"
        rx="1.2"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <rect
        x="14.4"
        y="3.6"
        width="6.2"
        height="16.8"
        rx="1.2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function AssignedToMeIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="flex-none">
      <circle
        cx="9.6"
        cy="8.2"
        r="3.4"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M3.4 19.6c0-3.2 2.8-5.4 6.2-5.4 1 0 2 .2 2.8.6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="m14.6 17.4 2.3 2.3 4.1-4.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
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

function RailLink({
  href,
  current,
  icon,
  label,
  count,
}: {
  href: string;
  current: boolean;
  icon: ReactNode;
  label: string;
  count?: number;
}) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={`${RAIL_ITEM_CLASSES} ${current ? RAIL_ITEM_CURRENT_CLASSES : ""}`}>
      {icon}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count === undefined ? null : (
        <span className="font-mono text-[10.5px] text-(--color-text-muted)">{count}</span>
      )}
    </Link>
  );
}

export function Sidebar({
  displayName,
  avatarUrl,
  isAdmin,
  projects = [],
  activeMemberCount,
  workCounts,
  adminCounts,
  createProjectAction,
  checkKeyAvailability,
  projectCandidates,
}: {
  displayName: string;
  avatarUrl: string | null;
  isAdmin: boolean;
  projects?: ProjectListRegionEntry[];
  activeMemberCount: number;
  workCounts: RailWorkCounts;
  adminCounts: RailAdminCounts | null;
  createProjectAction: (
    prevState: CreateProjectState,
    input: CreateProjectPayload,
  ) => Promise<CreateProjectState>;
  checkKeyAvailability: (key: string) => Promise<{ holder: { key: string; name: string } | null }>;
  projectCandidates: RosterEntry[];
}) {
  const pathname = usePathname();
  const memberLabel = activeMemberCount === 1 ? "1 member" : `${activeMemberCount} members`;

  return (
    <nav
      aria-label="Primary navigation"
      className="flex h-full w-(--size-rail) shrink-0 flex-col overflow-hidden border-e border-(--color-divider) bg-(--color-chrome-tint)">
      <div className="shrink-0 border-b border-(--color-divider) p-2">
        <div className="flex h-[34px] items-center gap-2 px-1.5">
          <span className="grid h-[22px] w-[22px] flex-none place-items-center rounded-sm bg-(--color-accent) font-mono text-[11px] text-(--color-on-accent)">
            O
          </span>
          <span className="grid min-w-0">
            <b className="truncate text-[13px] font-semibold">One Team</b>
            <small className="text-[10.5px] text-(--color-text-muted)">{memberLabel}</small>
          </span>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 content-start gap-3 overflow-y-auto p-2">
        {/* biome-ignore lint/a11y/useSemanticElements: fieldset carries form semantics that don't apply to a nav grouping */}
        <div
          role="group"
          aria-labelledby="rail-work-label"
          className="grid gap-px">
          <span
            id="rail-work-label"
            className={GROUP_LABEL_CLASSES}>
            Work
          </span>
          <RailLink
            href="/home"
            current={pathname === "/home"}
            icon={<HomeIcon />}
            label="Home"
          />
          <RailLink
            href="/work"
            current={pathname === "/work"}
            icon={<AllWorkIcon />}
            label="All work"
            count={workCounts.openIssues}
          />
          <RailLink
            href="/work?assignee=me"
            current={false}
            icon={<AssignedToMeIcon />}
            label="Assigned to me"
            count={workCounts.assignedToMe}
          />
          <RailLink
            href="/notifications"
            current={pathname === "/notifications"}
            icon={<BellIcon />}
            label="Notifications"
            count={workCounts.unreadNotifications}
          />
        </div>

        <ProjectListRegion
          isAdmin={isAdmin}
          entries={projects}
          createProjectAction={createProjectAction}
          checkKeyAvailability={checkKeyAvailability}
          candidates={projectCandidates}
        />

        {isAdmin && adminCounts ? (
          // biome-ignore lint/a11y/useSemanticElements: fieldset carries form semantics that don't apply to a nav grouping
          <div
            role="group"
            aria-labelledby="rail-admin-label"
            className="grid gap-px">
            <span
              id="rail-admin-label"
              className={GROUP_LABEL_CLASSES}>
              Admin
            </span>
            <RailLink
              href="/settings/accounts"
              current={pathname === "/settings/accounts"}
              icon={<AccountsIcon />}
              label="Accounts"
              count={adminCounts.accounts}
            />
            <RailLink
              href="/settings/labels"
              current={pathname === "/settings/labels"}
              icon={<LabelsIcon />}
              label="Labels"
              count={adminCounts.labels}
            />
          </div>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-(--color-divider) p-2">
        <UserChip
          displayName={displayName}
          avatarUrl={avatarUrl}
          current={pathname === "/profile"}
        />
      </div>
    </nav>
  );
}