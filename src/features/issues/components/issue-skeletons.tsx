const CREATE_ISSUE_FIELDS = ["title", "description", "columnId", "priority", "assigneeId", "dueDate"];

function SkeletonField({ field }: { field: string }) {
  const tall = field === "description";
  return (
    <div
      data-field={field}
      className={`animate-pulse bg-(--color-divider) ${tall ? "min-h-[8rem]" : "h-9"}`}
    />
  );
}

export function CreateIssueFormSkeleton() {
  return (
    <div className="flex flex-col gap-[14px] p-4.5">
      {CREATE_ISSUE_FIELDS.map((field) => (
        <SkeletonField
          key={field}
          field={field}
        />
      ))}
    </div>
  );
}

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