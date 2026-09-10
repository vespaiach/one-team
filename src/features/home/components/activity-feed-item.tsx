import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { activityActionPhrase } from "@/features/activity/components/activity-row";
import { displayName } from "@/lib/display-name";
import { formatRelativeTime } from "@/lib/relative-time";
import type { InstallationActivityRow } from "../server/activity-queries";

const MEMBER_KINDS = new Set(["member_added", "member_removed"]);

function issueKeyFrom(targetLabel: string): string {
  return targetLabel.split(" · ")[0] ?? targetLabel;
}

export function ActivityFeedItem({ row }: { row: InstallationActivityRow }) {
  const actorName = displayName(row.actor);
  const time = formatRelativeTime(row.createdAt, new Date());

  if (row.kind === "comment") {
    return (
      <div className="relative grid gap-1 py-1.5">
        <span
          aria-hidden="true"
          className="-left-[22px] absolute top-2 h-3 w-3 rounded-full bg-(--color-accent-600) ring-3 ring-(--color-bg)"
        />
        <div className="grid gap-1 rounded-sm border border-(--color-divider) p-2">
          <div className="flex items-center gap-1.5 text-[12px]">
            <Avatar
              name={actorName}
              avatarUrl={row.actor.avatarUrl}
              size="sm"
              decorative
            />
            <span className="font-medium">{actorName}</span>
            <span className="text-(--color-text-muted)">commented on</span>
            <Link
              href={row.href}
              className="font-mono text-[11px] text-(--color-text-muted) no-underline hover:underline">
              {issueKeyFrom(row.targetLabel)}
            </Link>
            <span className="ms-auto font-mono text-[10.5px] text-(--color-text-muted)">{time}</span>
          </div>
          <p className="text-[13.5px] leading-[1.55]">{row.body}</p>
        </div>
      </div>
    );
  }

  const isMemberEvent = MEMBER_KINDS.has(row.kind);
  const isIssueEvent = !isMemberEvent && row.targetLabel !== row.projectName;
  const phrase = activityActionPhrase(row.kind, row.field, row.fromValue, row.toValue);

  return (
    <div className="relative grid gap-1 py-1.5">
      <span
        aria-hidden="true"
        className="-left-[22px] absolute top-2 h-1.5 w-1.5 rounded-full bg-(--color-text-muted) ring-3 ring-(--color-bg)"
      />
      <Link
        href={row.href}
        className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-(--color-text-muted) no-underline">
        <Avatar
          name={actorName}
          avatarUrl={row.actor.avatarUrl}
          size="sm"
          decorative
        />
        <span className="font-medium text-(--color-text)">{actorName}</span>
        <span>
          {phrase}
          {isMemberEvent || isIssueEvent ? "" : ` ${row.targetLabel}`}
        </span>
        <span className="ms-auto font-mono text-[10.5px]">{time}</span>
      </Link>
      {isIssueEvent ? (
        <span className="pl-6 font-mono text-[11px] text-(--color-text-muted)">
          {issueKeyFrom(row.targetLabel)}
        </span>
      ) : null}
    </div>
  );
}