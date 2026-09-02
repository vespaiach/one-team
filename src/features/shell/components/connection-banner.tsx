"use client";

import { useEffect, useState } from "react";

export function ConnectionBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    setIsOffline(!navigator.onLine);

    function handleOnline() {
      setIsOffline(false);
    }
    function handleOffline() {
      setIsOffline(true);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!isOffline) {
    return null;
  }

  return (
    <div className="w-full bg-[var(--color-advisory-fill)] px-4 py-2 text-center text-sm text-[var(--color-advisory-text)]">
      You&rsquo;re offline. Changes can&rsquo;t be saved.
    </div>
  );
}