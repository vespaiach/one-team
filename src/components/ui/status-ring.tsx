import clsx from "clsx";

export type ProjectStatusRing = "todo" | "progress" | "done";

const RING_CLASSES: Record<ProjectStatusRing, string> = {
  todo: "border-(--color-neutral-700)",
  progress:
    "border-(--color-accent-2-600) bg-[conic-gradient(var(--color-accent-2-600)_0_60%,transparent_0)]",
  done: "border-(--color-accent-600) bg-(--color-accent-600)",
};

export function StatusRing({ status, size = "sm" }: { status: ProjectStatusRing; size?: "sm" | "lg" }) {
  return (
    <span
      aria-hidden="true"
      className={clsx(
        "inline-block flex-none rounded-full border-[1.5px]",
        size === "sm" ? "h-3.5 w-3.5" : "h-[17px] w-[17px]",
        RING_CLASSES[status],
      )}
    />
  );
}