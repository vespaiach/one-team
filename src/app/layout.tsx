import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AppShell } from "../components/AppShell";
import { AriaRouterProvider } from "../components/AriaRouterProvider";
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
        <AriaRouterProvider>
          <ToastProvider>
            <AppShell>{children}</AppShell>
          </ToastProvider>
        </AriaRouterProvider>
      </body>
    </html>
  );
}