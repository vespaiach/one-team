"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type Props = {
  href: string;
  children: ReactNode;
};

export function NavLink({ href, children }: Props) {
  const current = usePathname() === href;
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={
        "block rounded-sm px-2 py-1.5 text-body-sm " +
        (current ? "bg-surface-3 font-semibold text-ink hover:text-ink" : "text-ink-subtle hover:text-ink")
      }>
      {children}
    </Link>
  );
}