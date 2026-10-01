import type { Metadata } from "next";
import type { ReactNode } from "react";
import "../hairline/tokens/colors.css";
import "../hairline/tokens/typography.css";
import "../hairline/tokens/spacing.css";
import "../hairline/tokens/base.css";
import "../hairline/components/buttons/buttons.css";
import "../hairline/components/forms/forms.css";
import "./globals.css";
import { AppShell } from "../components/AppShell";
import { ToastProvider } from "../components/Toast";

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
