const ISSUE_DETAIL_RAIL_FIELDS = [
  "column",
  "priority",
  "assignee",
  "dueDate",
  "project",
  "createdBy",
  "createdAt",
  "updatedAt",
];

export function IssueDrawerSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="h-6 w-24 animate-pulse bg-(--color-divider)" />
      <div className="h-6 w-2/3 animate-pulse bg-(--color-divider)" />
      <div className="min-h-[6rem] animate-pulse bg-(--color-divider)" />
      {ISSUE_DETAIL_RAIL_FIELDS.slice(0, 4).map((field) => (
        <div
          key={field}
          data-field={field}
          className="h-9 animate-pulse bg-(--color-divider)"
        />
      ))}
    </div>
  );
}

export function IssueDetailSkeleton() {
  return (
    <div className="flex gap-6 p-4">
      <div
        data-region="main"
        className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="h-6 w-24 animate-pulse bg-(--color-divider)" />
        <div className="h-8 w-2/3 animate-pulse bg-(--color-divider)" />
        <div className="min-h-[8rem] animate-pulse bg-(--color-divider)" />
      </div>
      <div
        data-region="rail"
        className="flex w-[262px] shrink-0 flex-col gap-4">
        {ISSUE_DETAIL_RAIL_FIELDS.map((field) => (
          <div
            key={field}
            data-field={field}
            className="h-9 animate-pulse bg-(--color-divider)"
          />
        ))}
      </div>
    </div>
  );
}