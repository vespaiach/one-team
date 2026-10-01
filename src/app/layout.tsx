import type { Metadata } from "next";
import type { ReactNode } from "react";
import "../components/ui/hairline/tokens/colors.css";
import "../components/ui/hairline/tokens/typography.css";
import "../components/ui/hairline/tokens/spacing.css";
import "../components/ui/hairline/tokens/base.css";
import "../components/ui/hairline/components/buttons/buttons.css";
import "../components/ui/hairline/components/forms/forms.css";
import "../styles/globals.css";
import { AppShell } from "../components/layout/AppShell";
import { ToastProvider } from "../components/ui/Toast";

export const metadata: Metadata = {
  title: {
    default: "Tracklite",
    template: "%s · Tracklite",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          <AppShell>{children}</AppShell>
        </ToastProvider>
      </body>
    </html>
  );
}