"use client";

import { UNSTABLE_ToastQueue as ToastQueue } from "react-aria-components/Toast";

export type MessageKind = "success" | "info" | "warning" | "error";

export type Message = {
  kind: MessageKind;
  text: string;
};

export const messages = new ToastQueue<Message>({ maxVisibleToasts: 3 });

export function raiseMessage(kind: MessageKind, text: string): void {
  messages.add({ kind, text }, { timeout: 5000 });
}