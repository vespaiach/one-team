import Link from "next/link";
import { progressPercent } from "../progress";
import type { ProjectProgressRow as ProjectProgressRowData } from "../server/project-queries";

const TARGET_DATE_FORMAT = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

export function ProjectProgressRow({ row }: { row: ProjectProgressRowData }) {
  const percent = progressPercent(row.done, row.counted);
  const open = row.counted - row.done;

  return (
    <Link
      href={row.href}
      className="flex flex-col gap-1.5 px-4.5 py-2 text-control text-(--color-text) hover:bg-(--color-surface)">
      <span className="flex items-baseline gap-2">
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 flex-none self-center rounded-full bg-(--color-accent)"
        />
        <span className="min-w-0 truncate font-medium">{row.name}</span>
        <span className="text-(--color-text-muted)">{row.status}</span>
        <span className="ms-auto flex-none text-label text-(--color-text-muted)">{`${percent}%`}</span>
      </span>
      <span
        aria-hidden="true"
        className="h-1 w-full rounded-full bg-(--color-divider)">
        <span
          className="block h-full rounded-full bg-(--color-accent)"
          style={{ width: `${percent}%` }}
        />
      </span>
      <span className="flex items-center gap-2 text-label text-(--color-text-muted)">
        <span>{open === 1 ? "1 open" : `${open} open`}</span>
        {row.targetDate === null ? null : (
          <>
            <span>·</span>
            <span>{TARGET_DATE_FORMAT.format(new Date(row.targetDate))}</span>
          </>
        )}
      </span>
    </Link>
  );
}