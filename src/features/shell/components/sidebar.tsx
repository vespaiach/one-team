export function Sidebar() {
  return (
    <nav
      aria-label="Primary navigation"
      className="sticky start-0 flex w-[262px] shrink-0 flex-col self-stretch border-e-2 border-(--color-border) bg-(--color-bg) py-4">
      <section className="min-h-0 flex-1 overflow-y-auto" />
      <div className="mt-auto border-t-2 border-(--color-border)" />
    </nav>
  );
}