"use client";

import { useState } from "react";
import { Button } from "react-aria-components/Button";
import { Dialog, DialogTrigger } from "react-aria-components/Dialog";
import { Modal } from "react-aria-components/Modal";

function DeleteColumnConfirmDialog({
  columnName,
  onDelete,
  close,
}: {
  columnName: string;
  onDelete: () => Promise<void>;
  close: () => void;
}) {
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleConfirm() {
    setIsDeleting(true);
    await onDelete();
    close();
  }

  return (
    <Dialog className="flex w-full max-w-[420px] flex-col gap-[14px] bg-(--color-bg) p-4 shadow-lg">
      <h2 className="text-h5">Delete {columnName}?</h2>
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

export function DeleteColumnDialog({
  columnName,
  onDelete,
  describedById,
}: {
  columnName: string;
  onDelete: () => Promise<void>;
  describedById?: string;
}) {
  return (
    <DialogTrigger>
      <Button aria-describedby={describedById}>Delete</Button>
      <Modal
        isDismissable
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        {({ state }) => (
          <DeleteColumnConfirmDialog
            columnName={columnName}
            onDelete={onDelete}
            close={state.close}
          />
        )}
      </Modal>
    </DialogTrigger>
  );
}