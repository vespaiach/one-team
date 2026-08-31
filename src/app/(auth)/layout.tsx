export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-full flex-col items-center bg-[var(--color-page)] pt-[max(12vh,96px)] pb-16">
      <div className="flex w-full max-w-[var(--size-card)] flex-col gap-6">
        <p className="text-display font-semibold">
          <span className="text-[var(--color-text)]">One</span>
          <span className="text-[var(--color-accent)]">Team</span>
        </p>
        <div className="flex flex-col gap-6 border border-[var(--color-border)] bg-[var(--color-surface)] p-8">
          {children}
        </div>
      </div>
    </main>
  );
}