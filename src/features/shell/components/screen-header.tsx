import type { ReactNode } from "react";

export function ScreenHeader({
  name,
  context,
  control,
  newIssue,
}: {
  name: string;
  context?: ReactNode | null;
  control?: ReactNode | null;
  newIssue?: ReactNode | null;
}) {
  return (
    <header className="flex items-start justify-between gap-3.5 border-b-2 border-(--color-border) px-4.5 py-3">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-h5">{name}</h1>
        {context ? (
          <div className="mt-0.5 truncate text-label text-(--color-text-muted)">{context}</div>
        ) : null}
      </div>
      {control ? <div>{control}</div> : null}
      {newIssue ? <div>{newIssue}</div> : null}
    </header>
  );
}