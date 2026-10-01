"use client";

import { useSyncExternalStore } from "react";
import { formatTime } from "../lib/time.ts";

function subscribe() {
  return () => {};
}

export function LocalTime({ iso }: { iso: string }) {
  const text = useSyncExternalStore(
    subscribe,
    () => formatTime(iso, Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC"),
    () => "",
  );

  return <time dateTime={iso}>{text}</time>;
}