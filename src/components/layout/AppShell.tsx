import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-canvas font-text text-ink max-md:flex-col">
      <nav className="flex-[0_0_240px] border-r border-hairline bg-surface-1 px-4 py-6 max-md:flex-none max-md:border-r-0 max-md:border-b">
        <p className="font-display text-body font-semibold text-ink">Tracklite</p>
      </nav>
      <main className="min-w-0 flex-1 p-8 max-md:p-4">{children}</main>
    </div>
  );
}