"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function StatusMessage({
  children,
  focusOnShow = false,
}: {
  children: ReactNode;
  focusOnShow?: boolean;
}) {
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (focusOnShow) {
      heading.current?.focus();
    }
  }, [focusOnShow]);

  return (
    <div role="status">
      <h2
        ref={heading}
        tabIndex={-1}
        className="font-display text-card-title text-ink wrap-anywhere">
        {children}
      </h2>
    </div>
  );
}