import Link from "next/link";
import { ActivityRow as ActivitySentence } from "@/features/activity/components/activity-row";
import { displayName } from "@/lib/display-name";
import { formatRelativeTime } from "@/lib/relative-time";
import type { InstallationActivityRow } from "../server/activity-queries";

export function ActivityRow({ row }: { row: InstallationActivityRow }) {
  const targetIsTheProject = row.targetLabel === row.projectName;

  return (
    <Link
      href={row.href}
      className="flex items-baseline gap-2 px-4.5 py-2 text-control text-(--color-text) hover:bg-(--color-surface)">
      {row.kind === "comment" ? (
        <>
          <span className="font-medium">{displayName(row.actor)}</span>
          <span className="text-(--color-text-muted)">commented on</span>
        </>
      ) : (
        <ActivitySentence
          actor={row.actor}
          type={row.kind}
          field={row.field}
          fromValue={row.fromValue}
          toValue={row.toValue}
        />
      )}
      <span className="min-w-0 truncate">{row.targetLabel}</span>
      {targetIsTheProject ? null : (
        <span className="flex-none text-(--color-text-muted)">{row.projectName}</span>
      )}
      <span className="ms-auto flex-none text-label text-(--color-text-muted)">
        {formatRelativeTime(row.createdAt, new Date())}
      </span>
    </Link>
  );
}