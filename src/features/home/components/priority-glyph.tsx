import type { IssuePriority } from "@/features/issues/server/input";

const BAR_OPACITY: Record<Exclude<IssuePriority, "urgent">, [number, number, number]> = {
  high: [1, 1, 1],
  medium: [1, 1, 0.25],
  low: [1, 0.25, 0.25],
  none: [0.25, 0.25, 0.25],
};

export function PriorityGlyph({ priority }: { priority: IssuePriority }) {
  if (priority === "urgent") {
    return (
      <span
        role="img"
        aria-label="Urgent"
        className="grid h-[13px] w-[13px] flex-none place-items-center rounded-sm bg-(--color-accent-2-600) font-mono text-[10px] text-(--color-on-accent) leading-none">
        !
      </span>
    );
  }

  const [a, b, c] = BAR_OPACITY[priority];
  return (
    <span
      aria-hidden="true"
      className="flex h-[11px] flex-none items-end gap-[1.5px] text-(--color-text-muted)">
      <span
        className="w-[3px] rounded-[0.5px] bg-current"
        style={{ height: "4px", opacity: a }}
      />
      <span
        className="w-[3px] rounded-[0.5px] bg-current"
        style={{ height: "7.5px", opacity: b }}
      />
      <span
        className="w-[3px] rounded-[0.5px] bg-current"
        style={{ height: "11px", opacity: c }}
      />
    </span>
  );
}