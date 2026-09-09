import Logo from "@/app/components/common/logo";
import { AuthShowcase } from "./auth-showcase";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen bg-(--color-bg) font-[family-name:var(--font-body)] text-(--color-text) lg:grid-cols-[minmax(460px,1fr)_minmax(380px,44%)]">
      <div className="flex flex-col gap-8 overflow-y-auto px-6 py-10 sm:px-12 lg:px-16 lg:py-14">
        <Logo />
        <div className="mx-auto w-full max-w-[420px] lg:mx-0">{children}</div>
      </div>
      <AuthShowcase />
    </main>
  );
}