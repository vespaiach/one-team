"use client";

import { useEffect, useSyncExternalStore } from "react";

type Listener = () => void;

const listeners = new Set<Listener>();
let offline = false;

function setOffline(value: boolean): void {
  if (offline === value) {
    return;
  }
  offline = value;
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): boolean {
  return offline;
}

function getServerSnapshot(): boolean {
  return false;
}

export function useIsOffline(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function reportTransportFailure(): void {
  setOffline(true);
}

export function reportTransportSuccess(): void {
  setOffline(false);
}

export const CHANGES_NEED_A_CONNECTION = "Changes need a connection";

export type GuardedWrite<T> = { performed: true; result: T } | { performed: false; reason: string };

export async function guardedWrite<T>(perform: () => Promise<T>): Promise<GuardedWrite<T>> {
  if (getSnapshot()) {
    return { performed: false, reason: CHANGES_NEED_A_CONNECTION };
  }

  try {
    const result = await perform();
    reportTransportSuccess();
    return { performed: true, result };
  } catch (error) {
    reportTransportFailure();
    throw error;
  }
}

export function ConnectionBanner() {
  const isOffline = useIsOffline();

  useEffect(() => {
    const handleOffline = () => setOffline(true);
    const handleOnline = () => setOffline(false);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  if (!isOffline) {
    return null;
  }

  return (
    <div
      role="alert"
      className="border-l-[3px] border-(--color-accent) bg-(--color-accent-100) px-3 py-[11px] text-[13px]">
      Can't reach the server. Reconnecting.
    </div>
  );
}