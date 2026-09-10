const PLACEHOLDER_ROW_COUNT = 6;

export function AssignedListSkeleton() {
  return (
    <div
      aria-busy="true"
      className="flex flex-col">
      <div className="flex h-(--size-row) items-center border-b border-(--color-divider) bg-(--color-chrome-tint) px-3">
        <div className="h-3 w-20 animate-pulse bg-(--color-divider)" />
      </div>
      {Array.from({ length: PLACEHOLDER_ROW_COUNT }).map((_, index) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: placeholder rows carry no identity
          key={index}
          className="flex h-(--size-row-lg) items-center gap-2 border-b border-(--color-divider) px-3">
          <div className="h-3 w-12 flex-none animate-pulse bg-(--color-divider)" />
          <div className="h-3 w-64 animate-pulse bg-(--color-divider)" />
        </div>
      ))}
    </div>
  );
}