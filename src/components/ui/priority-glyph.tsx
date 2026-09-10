import clsx from "clsx";

export type Priority = "none" | "low" | "medium" | "high" | "urgent";

const PRIORITY_NAMES: Record<Priority, string> = {
  none: "No priority",
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

const BAR_HEIGHTS = ["h-1", "h-1.5", "h-2"] as const;
const SOLID_BAR_COUNT: Record<Priority, number> = { none: 0, low: 1, medium: 2, high: 3, urgent: 3 };

export function PriorityGlyph({ priority }: { priority: Priority }) {
  const label = PRIORITY_NAMES[priority];

  if (priority === "urgent") {
    return (
      <span
        role="img"
        aria-label={label}
        className="grid h-3.5 w-3.5 flex-none place-items-center bg-(--color-accent-2-600) font-mono text-[10px] text-(--color-on-accent) leading-none">
        !
      </span>
    );
  }

  const solidCount = SOLID_BAR_COUNT[priority];
  return (
    <span
      role="img"
      aria-label={label}
      className="inline-flex h-3 flex-none items-end gap-px text-(--color-text-muted)">
      {BAR_HEIGHTS.map((height, index) => (
        <i
          key={height}
          className={clsx(
            "w-[3px] bg-current not-italic",
            height,
            index < solidCount ? "opacity-100" : "opacity-25",
          )}
        />
      ))}
    </span>
  );
}