const PLACEHOLDER_ITEM_COUNT = 6;

export function ActivitySectionSkeleton() {
  return (
    <div
      aria-busy="true"
      className="grid gap-1 border-t border-(--color-divider) p-3">
      <div className="mb-1 h-3 w-24 animate-pulse bg-(--color-divider)" />
      {Array.from({ length: PLACEHOLDER_ITEM_COUNT }).map((_, index) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: placeholder rows carry no identity
          key={index}
          className="h-4 w-full animate-pulse bg-(--color-divider)"
        />
      ))}
    </div>
  );
}