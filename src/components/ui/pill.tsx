import clsx from "clsx";
import type { ReactNode } from "react";

const PILL_VARIANT_CLASSES = {
  id: "border border-(--color-divider) text-(--color-text-muted) font-mono",
  project: "bg-(--color-accent-100) text-(--color-accent-800) font-mono",
  label: "border border-(--color-divider) text-(--color-text-muted)",
  status: "border border-(--color-divider) text-(--color-text)",
} as const;

export function Pill({
  variant = "label",
  children,
}: {
  variant?: keyof typeof PILL_VARIANT_CLASSES;
  children: ReactNode;
}) {
  return (
    <span
      className={clsx(
        "inline-flex h-[19px] items-center gap-1 whitespace-nowrap px-1.5 text-caption",
        PILL_VARIANT_CLASSES[variant],
      )}>
      {children}
    </span>
  );
}