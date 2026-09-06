const PLACEHOLDER_ROW_COUNT = 6;

export function NotificationsSkeleton() {
  return (
    <ul
      aria-busy="true"
      className="flex flex-col divide-y divide-(--color-divider)">
      {Array.from({ length: PLACEHOLDER_ROW_COUNT }).map((_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: placeholder rows carry no identity
        <li key={index}>
          <div className="flex items-baseline gap-2 px-4.5 py-2">
            <div className="h-2 w-2 flex-none animate-pulse self-center rounded-full bg-(--color-divider)" />
            <div className="h-4 w-24 animate-pulse bg-(--color-divider)" />
            <div className="h-4 w-20 animate-pulse bg-(--color-divider)" />
            <div className="h-4 w-48 animate-pulse bg-(--color-divider)" />
            <div className="ms-auto h-4 w-16 flex-none animate-pulse bg-(--color-divider)" />
          </div>
        </li>
      ))}
    </ul>
  );
}