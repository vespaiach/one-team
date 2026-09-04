const ROW_KEYS = ["a", "b", "c", "d"];

export function FeedSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div
        data-region="composer"
        className="h-16 animate-pulse bg-(--color-divider)"
      />
      <div className="flex flex-col gap-3">
        {ROW_KEYS.map((key) => (
          <div
            key={key}
            data-region="row"
            className="h-10 animate-pulse bg-(--color-divider)"
          />
        ))}
      </div>
    </div>
  );
}