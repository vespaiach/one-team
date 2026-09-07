import type { CSSProperties } from "react";
import Logo from "@/app/components/common/logo";
import { AuthShowcase } from "./auth-showcase";

const THEME_VARS = {
  "--color-bg": "#f8f2ed",
  "--color-surface": "#efe3d9",
  "--color-text": "#2b1c15",
  "--color-divider": "color-mix(in srgb, #2b1c15 16%, transparent)",
  "--color-accent": "#8d4936",
  "--color-accent-100": "#faf0ec",
  "--color-accent-600": "#8d4936",
  "--color-accent-700": "#73382a",
  "--color-accent-800": "#56281d",
  "--color-accent-900": "#3a1a13",
  "--color-accent-fill": "#8d4936",
  "--color-accent-hover": "#73382a",
  "--color-accent-pressed": "#56281d",
  "--color-accent-text": "#8d4936",
  "--color-accent-2": "#dd7450",
  "--color-accent-2-100": "#fef2ec",
  "--color-accent-2-600": "#c1573a",
  "--color-accent-2-800": "#75301f",
  "--color-accent-2-900": "#4c1f14",
  "--font-heading": "var(--font-source-serif), Georgia, serif",
  "--font-body": "var(--font-source-serif), Georgia, serif",
} as CSSProperties;

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main
      style={THEME_VARS}
      className="grid min-h-screen bg-[var(--color-bg)] font-[family-name:var(--font-body)] text-[var(--color-text)] lg:grid-cols-[minmax(460px,1fr)_minmax(380px,44%)]">
      <div className="flex flex-col gap-8 overflow-y-auto px-6 py-10 sm:px-12 lg:px-16 lg:py-14">
        <Logo />
        <div className="mx-auto w-full max-w-[420px] lg:mx-0">{children}</div>
      </div>
      <AuthShowcase />
    </main>
  );
}