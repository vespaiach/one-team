export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[var(--color-bg)] px-4 py-16">
      <div className="flex w-full max-w-[var(--size-card)] flex-col">
        <div className="mb-[26px] flex items-center gap-[10px]">
          <svg
            width="20"
            height="20"
            viewBox="0 0 32 32"
            aria-hidden="true"
            className="flex-none text-[var(--color-text)]">
            <rect
              x="1"
              y="1"
              width="30"
              height="30"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            />
            <polygon
              points="7,10.3 12,6 16.3,6 16.3,26 12,26 12,11.4 9.1,13.5"
              fill="var(--color-accent)"
            />
            <rect
              x="20"
              y="6"
              width="4"
              height="20"
              fill="currentColor"
            />
          </svg>
          <span className="font-heading text-[14px] font-extrabold tracking-[-0.01em] text-[var(--color-text)]">
            One Team
          </span>
        </div>
        <div className="flex flex-col gap-6 border-2 border-[var(--color-divider)] bg-[var(--color-bg)] px-[30px] pt-[30px] pb-[26px]">
          {children}
        </div>
      </div>
    </main>
  );
}