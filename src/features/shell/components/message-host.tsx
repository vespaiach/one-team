"use client";

import { Button } from "react-aria-components/Button";
import {
  UNSTABLE_Toast as Toast,
  UNSTABLE_ToastContent as ToastContent,
  UNSTABLE_ToastRegion as ToastRegion,
} from "react-aria-components/Toast";
import { messages } from "../messages";

export function MessageHost() {
  return (
    <ToastRegion
      queue={messages}
      aria-label="Notifications"
      className="fixed top-4 end-4 z-50 flex flex-col gap-2">
      {({ toast }) => (
        <Toast
          toast={toast}
          className="flex items-center gap-3 border-2 border-(--color-border) bg-(--color-bg) px-3.5 py-2.5 text-control text-(--color-text) shadow-sm">
          <ToastContent>{toast.content.text}</ToastContent>
          <Button
            slot="close"
            aria-label="Dismiss"
            className="text-(--color-text-muted) hover:text-(--color-text)">
            ×
          </Button>
        </Toast>
      )}
    </ToastRegion>
  );
}