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