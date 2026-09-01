export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-full flex-col items-center bg-[var(--color-bg)] pt-[max(12vh,96px)] pb-16">
      <div className="flex w-full max-w-[var(--size-card)] flex-col gap-6">
        <p className="flex items-stretch text-[19px] leading-none font-black tracking-[0.02em] uppercase">
          <span className="bg-[var(--color-text)] px-[9px] py-[7px] text-white">One</span>
          <span className="bg-[var(--color-accent-fill)] px-[9px] py-[7px] text-[var(--color-on-accent)]">
            Team
          </span>
        </p>
        <div className="flex flex-col gap-6 border border-[var(--color-border)] bg-[var(--color-surface)] p-8">
          {children}
        </div>
      </div>
    </main>
  );
}