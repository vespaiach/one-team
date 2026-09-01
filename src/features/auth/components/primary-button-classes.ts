export function primaryButtonClasses({ pending }: { pending?: boolean } = {}): string {
  const background = pending
    ? "bg-[var(--color-accent-hover)]"
    : "bg-[var(--color-accent-fill)] data-[hovered]:bg-[var(--color-accent-hover)] data-[pressed]:bg-[var(--color-accent-pressed)]";

  return `flex w-full items-center justify-center gap-[9px] px-[14px] py-[11px] font-heading text-[14px] font-extrabold text-[var(--color-bg)] ${background} data-[disabled]:cursor-not-allowed data-[disabled]:opacity-45`;
}