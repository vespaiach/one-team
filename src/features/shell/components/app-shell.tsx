import type { ReactNode } from "react";
import { Sidebar } from "./sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-w-[1280px] flex-1">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-10 focus:bg-(--color-bg) focus:px-3 focus:py-2 focus:text-(--color-text)">
        Skip to content
      </a>
      <Sidebar />
      <main
        id="main-content"
        className="flex flex-1 flex-col bg-(--color-surface)">
        {children}
      </main>
    </div>
  );
}