"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { RouterProvider } from "react-aria-components";

export function AriaRouterProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  return <RouterProvider navigate={router.push}>{children}</RouterProvider>;
}