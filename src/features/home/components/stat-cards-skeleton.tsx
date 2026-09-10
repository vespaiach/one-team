const PLACEHOLDER_CARD_COUNT = 3;

export function StatCardsSkeleton() {
  return (
    <ul
      aria-busy="true"
      className="flex gap-8 border-b-2 border-(--color-border) px-4.5 pb-4.5">
      {Array.from({ length: PLACEHOLDER_CARD_COUNT }).map((_, index) => (
        <li
          // biome-ignore lint/suspicious/noArrayIndexKey: placeholder cards carry no identity
          key={index}
          className="flex flex-col gap-1">
          <div className="h-6 w-10 animate-pulse bg-(--color-divider)" />
          <div className="h-4 w-24 animate-pulse bg-(--color-divider)" />
        </li>
      ))}
    </ul>
  );
}