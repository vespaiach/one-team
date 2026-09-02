"use client";

import { Button } from "react-aria-components/Button";
import {
  UNSTABLE_Toast as Toast,
  UNSTABLE_ToastContent as ToastContent,
  UNSTABLE_ToastQueue as ToastQueue,
  UNSTABLE_ToastRegion as ToastRegionPrimitive,
} from "react-aria-components/Toast";

export type ToastKind = "success" | "info" | "warning" | "error";

export type ToastRecord = {
  kind: ToastKind;
  message: string;
};

export const TOAST_TIMEOUT_MS = 5000;

export const toastQueue = new ToastQueue<ToastRecord>();

export function showToast(toast: ToastRecord): void {
  toastQueue.add(toast, { timeout: TOAST_TIMEOUT_MS });
}

const KIND_CLASSES: Record<ToastKind, string> = {
  success: "border-(--color-accent) bg-(--color-accent-100)",
  info: "border-(--color-border) bg-(--color-surface)",
  warning: "border-amber-500 bg-amber-50",
  error: "border-red-600 bg-red-50",
};

export function ToastRegion() {
  return (
    <ToastRegionPrimitive
      queue={toastQueue}
      aria-label="Notifications"
      className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {({ toast }) => (
        <Toast
          toast={toast}
          className={`flex items-center gap-3 border-l-[3px] px-3 py-[11px] text-[13px] ${KIND_CLASSES[toast.content.kind]}`}>
          <ToastContent>{toast.content.message}</ToastContent>
          <Button
            slot="close"
            aria-label="Dismiss">
            Dismiss
          </Button>
        </Toast>
      )}
    </ToastRegionPrimitive>
  );
}