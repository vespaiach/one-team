import clsx from "clsx";

export function primaryButtonClasses({
  pending,
  className,
}: {
  pending?: boolean;
  className?: string;
} = {}): string {
  const background = pending
    ? "bg-[var(--color-accent-hover)]"
    : "bg-[var(--color-accent-fill)] data-[hovered]:bg-[var(--color-accent-hover)] data-[pressed]:bg-[var(--color-accent-pressed)]";

  return clsx(
    `flex w-full items-center justify-center gap-2 px-3 py-2 font-[family-name:var(--font-heading)] text-[14px] font-extrabold text-[var(--color-bg)] ${background} data-[disabled]:cursor-not-allowed data-[disabled]:opacity-45`,
    className,
  );
}