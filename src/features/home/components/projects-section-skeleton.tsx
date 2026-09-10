const PLACEHOLDER_CARD_COUNT = 3;

export function ProjectsSectionSkeleton() {
  return (
    <div
      aria-busy="true"
      className="grid gap-2 p-3">
      <div className="h-3 w-20 animate-pulse bg-(--color-divider)" />
      {Array.from({ length: PLACEHOLDER_CARD_COUNT }).map((_, index) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: placeholder cards carry no identity
          key={index}
          className="grid gap-2 rounded-sm border border-(--color-divider) p-3">
          <div className="h-4 w-32 animate-pulse bg-(--color-divider)" />
          <div className="h-[5px] w-full animate-pulse bg-(--color-divider)" />
          <div className="h-3 w-24 animate-pulse bg-(--color-divider)" />
        </div>
      ))}
    </div>
  );
}