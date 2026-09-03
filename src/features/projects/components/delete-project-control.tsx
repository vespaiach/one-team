"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "react-aria-components/Button";
import { Dialog, DialogTrigger } from "react-aria-components/Dialog";
import { Modal } from "react-aria-components/Modal";
import { showToast } from "@/features/shell/components/toast-region";

export type DeleteProjectResult =
  | { status: "deleted" }
  | { status: "not_archived" }
  | { status: "forbidden" };

const DISABLED_REASON_ID = "delete-project-disabled-reason";

function DeleteConfirmDialog({
  projectName,
  cascadeCount,
  onDelete,
  close,
}: {
  projectName: string;
  cascadeCount: number;
  onDelete: () => Promise<DeleteProjectResult>;
  close: () => void;
}) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleConfirm() {
    setIsDeleting(true);
    const result = await onDelete();
    if (result.status === "deleted") {
      close();
      router.push("/home");
      return;
    }
    setIsDeleting(false);
    close();
    showToast({ kind: "error", message: `Couldn't delete ${projectName}. Try again.` });
  }

  return (
    <Dialog className="flex w-full max-w-[420px] flex-col gap-[14px] bg-(--color-bg) p-4 shadow-lg">
      <h2 className="text-h5">Delete {projectName}?</h2>
      <p>
        This permanently deletes {cascadeCount} {cascadeCount === 1 ? "row" : "rows"} that reference it — its
        columns and its members — and cannot be undone.
      </p>
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

export function DeleteProjectControl({
  projectName,
  cascadeCount,
  isDisabled = false,
  disabledReason,
  onDelete,
}: {
  projectName: string;
  cascadeCount: number;
  isDisabled?: boolean;
  disabledReason?: string;
  onDelete: () => Promise<DeleteProjectResult>;
}) {
  const reasonId = isDisabled && disabledReason ? DISABLED_REASON_ID : undefined;

  return (
    <div className="flex flex-col gap-1">
      <DialogTrigger>
        <Button
          isDisabled={isDisabled}
          aria-describedby={reasonId}>
          Delete
        </Button>
        <Modal
          isDismissable
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          {({ state }) => (
            <DeleteConfirmDialog
              projectName={projectName}
              cascadeCount={cascadeCount}
              onDelete={onDelete}
              close={state.close}
            />
          )}
        </Modal>
      </DialogTrigger>
      {isDisabled && disabledReason ? (
        <p
          id={reasonId}
          className="text-label text-(--color-text-muted)">
          {disabledReason}
        </p>
      ) : null}
    </div>
  );
}