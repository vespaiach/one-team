import type { ReactNode } from "react";

export default function SignInLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-8 font-text text-ink max-md:items-start max-md:p-4">
      <div className="w-full max-w-100">{children}</div>
    </main>
  );
}