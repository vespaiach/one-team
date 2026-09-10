const METRIC_COUNT = 3;

export function MetricStripSkeleton() {
  return (
    <div
      aria-busy="true"
      className="flex shrink-0 gap-8 border-b border-(--color-divider) p-3">
      {Array.from({ length: METRIC_COUNT }).map((_, index) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: placeholder metrics carry no identity
          key={index}
          className="grid gap-1">
          <div className="h-[26px] w-10 animate-pulse bg-(--color-divider)" />
          <div className="h-3 w-24 animate-pulse bg-(--color-divider)" />
        </div>
      ))}
    </div>
  );
}