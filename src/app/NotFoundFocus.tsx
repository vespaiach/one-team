"use client";

import { useEffect } from "react";

export function NotFoundFocus({ headingId }: { headingId: string }) {
  useEffect(() => {
    const loadedUrl = performance.getEntriesByType("navigation")[0]?.name;
    if (loadedUrl !== undefined && loadedUrl !== window.location.href) {
      document.getElementById(headingId)?.focus();
    }
  }, [headingId]);
  return null;
}
