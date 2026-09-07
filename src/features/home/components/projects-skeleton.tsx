const PLACEHOLDER_ROW_COUNT = 3;

export function ProjectsSkeleton() {
  return (
    <section
      aria-busy="true"
      className="flex flex-col">
      <h2 className="px-4.5 py-2 text-label text-(--color-text-muted)">Your projects</h2>
      <ul className="flex flex-col divide-y divide-(--color-divider)">
        {Array.from({ length: PLACEHOLDER_ROW_COUNT }).map((_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: placeholder rows carry no identity
          <li key={index}>
            <div className="flex items-baseline gap-2 px-4.5 py-2 text-control">
              <div className="h-4 w-40 animate-pulse bg-(--color-divider)" />
              <div className="h-4 w-14 animate-pulse bg-(--color-divider)" />
              <div className="ms-auto h-4 w-10 flex-none animate-pulse bg-(--color-divider)" />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}