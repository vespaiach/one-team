export function CardFooterNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-[18px] border-t border-[var(--color-divider)] pt-4 text-[13px] text-[color-mix(in_srgb,var(--color-text)_60%,transparent)]">
      {children}
    </div>
  );
}