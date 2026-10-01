import type { Metadata } from "next";
import type { ReactNode } from "react";
import "../styles/globals.css";
import { AppShell } from "../components/layout/AppShell";
import { AriaRouterProvider } from "../components/layout/AriaRouterProvider";
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
        <AriaRouterProvider>
          <ToastProvider>
            <AppShell>{children}</AppShell>
          </ToastProvider>
        </AriaRouterProvider>
      </body>
    </html>
  );
}