const ROWS = ["avatar", "firstName", "lastName", "jobTitle", "slackHandle", "phone", "bio", "email", "role"];

function SkeletonBar({ row }: { row: string }) {
  const tall = row === "bio";
  return (
    <div
      data-row={row}
      className={`animate-pulse bg-(--color-divider) ${tall ? "min-h-[4.5rem]" : "h-6"}`}
    />
  );
}

export function ProfileSkeleton() {
  return (
    <div className="flex flex-col gap-5 p-4.5">
      {ROWS.map((row) => (
        <SkeletonBar
          key={row}
          row={row}
        />
      ))}
    </div>
  );
}