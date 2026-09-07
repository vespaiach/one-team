import Link from "next/link";
import { progressPercent } from "../progress";
import type { ProjectProgressRow as ProjectProgressRowData } from "../server/project-queries";

export function ProjectProgressRow({ row }: { row: ProjectProgressRowData }) {
  return (
    <Link
      href={row.href}
      className="flex items-baseline gap-2 px-4.5 py-2 text-control text-(--color-text) hover:bg-(--color-surface)">
      <span className="min-w-0 truncate font-medium">{row.name}</span>
      <span className="text-(--color-text-muted)">{row.status}</span>
      <span className="ms-auto flex-none text-label text-(--color-text-muted)">
        {`${progressPercent(row.done, row.counted)}%`}
      </span>
    </Link>
  );
}