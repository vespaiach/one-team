"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "react-aria-components/Button";
import { Dialog, DialogTrigger } from "react-aria-components/Dialog";
import { Modal } from "react-aria-components/Modal";
import { dialogPanelCompactClassName } from "@/components/shared/dialog-panel";
import type { AccountRow } from "../server/roster";

const HIGHLIGHT_TIMEOUT_MS = 5000;
const LAST_ADMIN_REASON = "The last active admin can't be deactivated.";

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

const TABLE_HEADER_CLASSES = "px-3 py-2 text-start font-sans text-label text-(--color-text-muted)";
const TABLE_CELL_CLASSES = "px-3 py-2";

function DeactivateControl({
  row,
  isLastActiveAdmin,
  onDeactivate,
}: {
  row: AccountRow;
  isLastActiveAdmin: boolean;
  onDeactivate: (accountId: string) => void;
}) {
  const reasonId = useId();

  return (
    <DialogTrigger>
      <Button
        isDisabled={isLastActiveAdmin}
        aria-describedby={isLastActiveAdmin ? reasonId : undefined}>
        Deactivate
      </Button>
      {isLastActiveAdmin && <span id={reasonId}>{LAST_ADMIN_REASON}</span>}
      {!isLastActiveAdmin && (
        <Modal
          isDismissable={false}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          {({ state }) => (
            <Dialog className={dialogPanelCompactClassName}>
              <p>
                Deactivating {row.displayName} keeps their memberships, assignments, comments and activity.
              </p>
              <Button onPress={state.close}>Cancel</Button>
              <Button
                onPress={() => {
                  onDeactivate(row.id);
                  state.close();
                }}>
                Deactivate
              </Button>
            </Dialog>
          )}
        </Modal>
      )}
    </DialogTrigger>
  );
}

function ReactivateControl({
  row,
  onReactivate,
}: {
  row: AccountRow;
  onReactivate: (accountId: string) => void;
}) {
  return (
    <DialogTrigger>
      <Button>Reactivate</Button>
      <Modal
        isDismissable={false}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        {({ state }) => (
          <Dialog className={dialogPanelCompactClassName}>
            <p>
              Reactivating {row.displayName} restores sign-in and picker eligibility, with the memberships
              they already had. No new link and no invitation is issued.
            </p>
            <Button onPress={state.close}>Cancel</Button>
            <Button
              onPress={() => {
                onReactivate(row.id);
                state.close();
              }}>
              Reactivate
            </Button>
          </Dialog>
        )}
      </Modal>
    </DialogTrigger>
  );
}

export function RosterTable({
  rows,
  activeAdminCount,
  highlightedAccountId,
  onClearHighlight,
  onDeactivate,
  onReactivate,
}: {
  rows: AccountRow[];
  activeAdminCount: number;
  highlightedAccountId: string | null;
  onClearHighlight: () => void;
  onDeactivate: (accountId: string) => void;
  onReactivate: (accountId: string) => void;
}) {
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    if (!highlightedAccountId) {
      return;
    }
    const row = rowRefs.current.get(highlightedAccountId);
    const account = rows.find((candidate) => candidate.id === highlightedAccountId);
    if (row && account) {
      row.scrollIntoView?.({ block: "nearest" });
      row.focus();
      setAnnouncement(`Reached ${account.displayName}'s row.`);
    }

    const timer = setTimeout(onClearHighlight, HIGHLIGHT_TIMEOUT_MS);
    const clearOnInteraction = () => onClearHighlight();
    document.addEventListener("pointerdown", clearOnInteraction, { once: true });
    document.addEventListener("keydown", clearOnInteraction, { once: true });
    return () => {
      clearTimeout(timer);
      document.removeEventListener("pointerdown", clearOnInteraction);
      document.removeEventListener("keydown", clearOnInteraction);
    };
  }, [highlightedAccountId, onClearHighlight, rows]);

  return (
    <>
      <div
        aria-live="polite"
        className="sr-only">
        {announcement}
      </div>
      <table className="w-full border-collapse text-control">
        <thead>
          <tr className="border-(--color-border) border-b">
            <th className={TABLE_HEADER_CLASSES}>Avatar</th>
            <th className={TABLE_HEADER_CLASSES}>Name</th>
            <th className={TABLE_HEADER_CLASSES}>Email</th>
            <th className={TABLE_HEADER_CLASSES}>Role</th>
            <th className={TABLE_HEADER_CLASSES}>Joined</th>
            <th className={TABLE_HEADER_CLASSES}>Projects</th>
            <th className={TABLE_HEADER_CLASSES}>Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-(--color-divider)">
          {rows.map((row) => {
            const isLastActiveAdmin = row.isActive && row.role === "admin" && activeAdminCount <= 1;
            return (
              <tr
                key={row.id}
                ref={(element) => {
                  if (element) {
                    rowRefs.current.set(row.id, element);
                  } else {
                    rowRefs.current.delete(row.id);
                  }
                }}
                tabIndex={-1}
                data-highlighted={row.id === highlightedAccountId ? "true" : undefined}>
                <td className={TABLE_CELL_CLASSES}>
                  {/* biome-ignore lint/performance/noImgElement: avatarUrl is an arbitrary external URL, not an allow-listable domain for next/image */}
                  <img
                    src={row.avatarUrl ?? undefined}
                    alt={row.displayName}
                    width={32}
                    height={32}
                  />
                </td>
                <td className={TABLE_CELL_CLASSES}>{row.displayName}</td>
                <td className={TABLE_CELL_CLASSES}>{row.email}</td>
                <td className={TABLE_CELL_CLASSES}>{row.role}</td>
                <td className={TABLE_CELL_CLASSES}>
                  <span className="font-mono">{DATE_FORMAT.format(row.joinedAt)}</span>
                </td>
                <td className={TABLE_CELL_CLASSES}>
                  <span className="font-mono">{row.projectCount}</span>
                </td>
                <td className={TABLE_CELL_CLASSES}>
                  {row.isActive ? (
                    <DeactivateControl
                      row={row}
                      isLastActiveAdmin={isLastActiveAdmin}
                      onDeactivate={onDeactivate}
                    />
                  ) : (
                    <ReactivateControl
                      row={row}
                      onReactivate={onReactivate}
                    />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}