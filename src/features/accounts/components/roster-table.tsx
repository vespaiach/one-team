"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "react-aria-components/Button";
import { Dialog, DialogTrigger } from "react-aria-components/Dialog";
import { Modal } from "react-aria-components/Modal";
import type { AccountRow } from "../server/roster";

const HIGHLIGHT_TIMEOUT_MS = 5000;
const LAST_ADMIN_REASON = "The last active admin can't be deactivated.";

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

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
            <Dialog className="flex w-full max-w-[420px] flex-col gap-[10px] bg-(--color-bg) p-4 shadow-lg">
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
          <Dialog className="flex w-full max-w-[420px] flex-col gap-[10px] bg-(--color-bg) p-4 shadow-lg">
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
      <table>
        <thead>
          <tr>
            <th>Avatar</th>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Joined</th>
            <th>Projects</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
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
                <td>
                  <img
                    src={row.avatarUrl ?? undefined}
                    alt={row.displayName}
                    width={32}
                    height={32}
                  />
                </td>
                <td>{row.displayName}</td>
                <td>{row.email}</td>
                <td>{row.role}</td>
                <td>{DATE_FORMAT.format(row.joinedAt)}</td>
                <td>{row.projectCount}</td>
                <td>
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