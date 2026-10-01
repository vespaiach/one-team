"use client";

import { useEffect, useState } from "react";

export function Loading() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 301);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <div
      role="status"
      aria-label="Loading"
      className="size-6 animate-[spin_800ms_linear_infinite] rounded-full border-2 border-hairline border-t-primary"
    />
  );
}