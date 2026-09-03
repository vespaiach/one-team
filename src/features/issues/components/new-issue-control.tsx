"use client";

import { Link } from "react-aria-components/Link";

export function NewIssueControl({
  projectKey,
  writeReason,
  canWrite,
}: {
  projectKey: string;
  canWrite: boolean;
  writeReason: string;
}) {
  const reasonId = canWrite ? undefined : "new-issue-control-reason";

  return (
    <div className="flex flex-col items-end gap-1">
      <Link
        href={`/projects/${projectKey}/issues/new`}
        isDisabled={!canWrite}
        aria-describedby={reasonId}
        className="text-control text-(--color-accent) data-[disabled]:text-(--color-text-muted) data-[hovered]:underline data-[focus-visible]:outline-2 data-[focus-visible]:outline-(--color-accent)">
        New issue
      </Link>
      {!canWrite ? (
        <p
          id={reasonId}
          className="text-label text-(--color-text-muted)">
          {writeReason}
        </p>
      ) : null}
    </div>
  );
}