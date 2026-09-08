"use client";

import { useId, useState } from "react";
import { Button } from "react-aria-components/Button";
import { markAllNotificationsRead } from "../actions";

const NOTHING_TO_CLEAR = "Nothing to clear";

export function MarkAllReadControl({ unreadCount }: { unreadCount: number }) {
  const [pending, setPending] = useState(false);
  const reasonId = useId();
  const nothingToClear = unreadCount === 0;

  async function markAll() {
    setPending(true);
    try {
      await markAllNotificationsRead();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {nothingToClear ? (
        <span
          id={reasonId}
          className="text-label text-(--color-text-muted)">
          {NOTHING_TO_CLEAR}
        </span>
      ) : null}
      <Button
        aria-describedby={nothingToClear ? reasonId : undefined}
        isDisabled={nothingToClear || pending}
        onPress={() => {
          void markAll();
        }}
        className="rounded-[var(--radius-md)] border border-(--color-divider) px-3 py-1 text-control text-(--color-text) data-[disabled]:text-(--color-text-muted) data-[focus-visible]:outline-2 data-[focus-visible]:outline-(--color-accent) data-[hovered]:bg-(--color-surface)">
        Mark all read
      </Button>
      {pending ? <span className="text-label text-(--color-text-muted)">Marking…</span> : null}
    </div>
  );
}