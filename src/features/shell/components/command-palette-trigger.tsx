"use client";

import { Button } from "react-aria-components/Button";
import { Dialog, DialogTrigger } from "react-aria-components/Dialog";
import { Modal } from "react-aria-components/Modal";

const KBD_CLASSES =
  "flex h-4.5 min-w-4.5 items-center justify-center rounded-sm border border-(--color-divider) px-1 font-mono text-caption";

export function CommandPaletteTrigger() {
  return (
    <DialogTrigger>
      <Button className="flex items-center gap-2 text-control text-(--color-text-muted) hover:text-(--color-text)">
        Search
        <span className="flex items-center gap-1">
          <span className={KBD_CLASSES}>⌘</span>
          <span className={KBD_CLASSES}>K</span>
        </span>
      </Button>
      <Modal
        isDismissable
        className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[12vh]">
        <Dialog className="flex w-full max-w-[560px] flex-col overflow-hidden bg-(--color-bg) shadow-lg">
          <div className="flex items-center gap-3 border-b-2 border-(--color-border) px-4 py-3">
            <input
              type="text"
              placeholder="Search issues, or run a command…"
              className="w-full border-0 bg-transparent text-h6 text-(--color-text) outline-none placeholder:text-(--color-text-placeholder)"
              readOnly
            />
            <span className={KBD_CLASSES}>esc</span>
          </div>
          <ul className="flex flex-col gap-1 p-2">
            <li className="px-2 py-1 text-caption text-(--color-text-muted) uppercase tracking-[0.08em]">
              Actions
            </li>
            <li className="flex items-center gap-2 px-2 py-1.5 text-control text-(--color-text-muted)">
              Create issue
            </li>
            <li className="flex items-center gap-2 px-2 py-1.5 text-control text-(--color-text-muted)">
              Switch to board
            </li>
            <li className="flex items-center gap-2 px-2 py-1.5 text-control text-(--color-text-muted)">
              Toggle sidebar
            </li>
          </ul>
        </Dialog>
      </Modal>
    </DialogTrigger>
  );
}