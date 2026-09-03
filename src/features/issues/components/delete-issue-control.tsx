"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "react-aria-components/Button";
import { Dialog, DialogTrigger } from "react-aria-components/Dialog";
import { Modal } from "react-aria-components/Modal";
import { showToast } from "@/features/shell/components/toast-region";
import type { DeleteIssuePayload, DeleteIssueResult } from "../actions";

const DISABLED_REASON_ID = "delete-issue-disabled-reason";
const CASCADE_CLAUSES: string[] = [];

function DeleteConfirmDialog({
  issueKey,
  issueTitle,
  projectKey,
  onConfirm,
  close,
}: {
  issueKey: string;
  issueTitle: string;
  projectKey: string;
  onConfirm: () => Promise<DeleteIssueResult>;
  close: () => void;
}) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleConfirm() {
    setIsDeleting(true);
    const result = await onConfirm();
    if (result.status === "ok") {
      close();
      router.push(`/projects/${projectKey}/details`);
      return;
    }
    setIsDeleting(false);
    close();
    showToast({ kind: "error", message: `Couldn't delete ${issueKey}. Try again.` });
  }

  const sentence = [...CASCADE_CLAUSES, "This can't be undone."].join(" ");

  return (
    <Dialog
      role="alertdialog"
      className="flex w-full max-w-[420px] flex-col gap-[14px] bg-(--color-bg) p-4 shadow-lg">
      <h2 className="text-h5">
        Delete {issueKey} · {issueTitle}?
      </h2>
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

export function DeleteIssueControl({
  issueId,
  issueKey,
  issueTitle,
  projectKey,
  canDelete,
  deleteReason,
  deleteIssueAction,
}: {
  issueId: string;
  issueKey: string;
  issueTitle: string;
  projectKey: string;
  canDelete: boolean;
  deleteReason: string;
  deleteIssueAction: (input: DeleteIssuePayload) => Promise<DeleteIssueResult>;
}) {
  const reasonId = !canDelete && deleteReason ? DISABLED_REASON_ID : undefined;

  function runDelete(): Promise<DeleteIssueResult> {
    return deleteIssueAction({ issueId, projectKey });
  }

  return (
    <div className="flex flex-col gap-1">
      <DialogTrigger>
        <Button
          isDisabled={!canDelete}
          aria-describedby={reasonId}>
          Delete
        </Button>
        <Modal
          isDismissable
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          {({ state }) => (
            <DeleteConfirmDialog
              issueKey={issueKey}
              issueTitle={issueTitle}
              projectKey={projectKey}
              onConfirm={runDelete}
              close={state.close}
            />
          )}
        </Modal>
      </DialogTrigger>
      {!canDelete && deleteReason ? (
        <p
          id={reasonId}
          className="text-label text-(--color-text-muted)">
          {deleteReason}
        </p>
      ) : null}
    </div>
  );
}