"use client";

import { Button } from "react-aria-components/Button";
import { Dialog, DialogTrigger } from "react-aria-components/Dialog";
import { Modal } from "react-aria-components/Modal";
import { dialogPanelClassName } from "@/components/shared/dialog-panel";
import type { LabelOption } from "@/features/labels/server/queries";
import { createIssue } from "../actions";
import type { AssigneeOption, IssueColumnOption } from "../server/issue-queries";
import { CreateIssueForm } from "./create-issue-form";

export function NewIssueModal({
  projectId,
  projectKey,
  columns,
  assigneePool,
  labelOptions,
  canManageLabels,
  canWrite,
  writeReason,
  defaultOpen,
}: {
  projectId: string;
  projectKey: string;
  columns: IssueColumnOption[];
  assigneePool: AssigneeOption[];
  labelOptions: LabelOption[];
  canManageLabels: boolean;
  canWrite: boolean;
  writeReason: string;
  defaultOpen?: boolean;
}) {
  const reasonId = canWrite ? undefined : "new-issue-modal-reason";

  return (
    <div className="flex flex-col items-end gap-1">
      <DialogTrigger defaultOpen={defaultOpen}>
        <Button
          isDisabled={!canWrite}
          aria-describedby={reasonId}
          className="text-control text-(--color-accent) data-[disabled]:text-(--color-text-muted) data-[hovered]:underline data-[focus-visible]:outline-2 data-[focus-visible]:outline-(--color-accent)">
          New issue
        </Button>
        <Modal
          isDismissable
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[10vh]">
          {({ state }) => (
            <Dialog className={dialogPanelClassName}>
              <h2 className="text-h5">New issue</h2>
              <CreateIssueForm
                projectId={projectId}
                projectKey={projectKey}
                columns={columns}
                assigneePool={assigneePool}
                labelOptions={labelOptions}
                canManageLabels={canManageLabels}
                createIssueAction={createIssue}
                onCancel={state.close}
              />
            </Dialog>
          )}
        </Modal>
      </DialogTrigger>
      {!canWrite ? (
        <p
          id={reasonId}
          className="text-label text-(--color-text-muted)">
          {writeReason}
        </p>
      ) : null}
    </div>
  );
}