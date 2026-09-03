"use client";

import { useState } from "react";
import { Button } from "react-aria-components/Button";
import { Dialog, DialogTrigger } from "react-aria-components/Dialog";
import { Modal } from "react-aria-components/Modal";
import { showToast } from "@/features/shell/components/toast-region";
import type { DeleteLabelResult } from "../server/delete-label";

function DeleteConfirmDialog({
  labelId,
  labelName,
  issueCount,
  deleteLabelAction,
  close,
}: {
  labelId: string;
  labelName: string;
  issueCount: number;
  deleteLabelAction: (id: string) => Promise<DeleteLabelResult>;
  close: () => void;
}) {
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleConfirm() {
    setIsDeleting(true);
    const result = await deleteLabelAction(labelId);
    setIsDeleting(false);
    close();
    if (!result.ok) {
      showToast({ kind: "error", message: `Couldn't delete ${labelName}. Try again.` });
    }
  }

  const sentence =
    issueCount > 0
      ? `It will be removed from ${issueCount} issues. This can't be undone.`
      : "This can't be undone.";

  return (
    <Dialog
      role="alertdialog"
      className="flex w-full max-w-[420px] flex-col gap-[14px] bg-(--color-bg) p-4 shadow-lg">
      <h2 className="text-h5">Delete {labelName}?</h2>
      <p>{sentence}</p>
      <div className="flex justify-end gap-[8px]">
        <Button
          type="button"
          onPress={close}>
          Cancel
        </Button>
        <Button
          type="button"
          onPress={handleConfirm}
          isDisabled={isDeleting}
          aria-label="Confirm delete">
          {isDeleting ? "Deleting…" : "Delete"}
        </Button>
      </div>
    </Dialog>
  );
}

export function DeleteLabelDialog({
  labelId,
  labelName,
  issueCount,
  deleteLabelAction,
}: {
  labelId: string;
  labelName: string;
  issueCount: number;
  deleteLabelAction: (id: string) => Promise<DeleteLabelResult>;
}) {
  return (
    <DialogTrigger>
      <Button>Delete</Button>
      <Modal
        isDismissable
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        {({ state }) => (
          <DeleteConfirmDialog
            labelId={labelId}
            labelName={labelName}
            issueCount={issueCount}
            deleteLabelAction={deleteLabelAction}
            close={state.close}
          />
        )}
      </Modal>
    </DialogTrigger>
  );
}