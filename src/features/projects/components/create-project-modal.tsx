"use client";

import type { ReactNode } from "react";
import { Button } from "react-aria-components/Button";
import { Dialog, DialogTrigger } from "react-aria-components/Dialog";
import { Modal } from "react-aria-components/Modal";
import { dialogPanelClassName } from "@/components/shared/dialog-panel";
import type { CreateProjectPayload, CreateProjectState } from "../actions";
import type { RosterEntry } from "../server/queries";
import { CreateProjectForm } from "./create-project-form";
import { CloseIcon } from "./icons";

export function CreateProjectModal({
  createProjectAction,
  checkKeyAvailability,
  candidates,
  trigger,
}: {
  createProjectAction: (
    prevState: CreateProjectState,
    input: CreateProjectPayload,
  ) => Promise<CreateProjectState>;
  checkKeyAvailability: (key: string) => Promise<{ holder: { key: string; name: string } | null }>;
  candidates: RosterEntry[];
  trigger?: ReactNode;
}) {
  return (
    <DialogTrigger>
      {trigger ?? <Button className="text-control text-(--color-accent) hover:underline">New project</Button>}
      <Modal
        isDismissable={false}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        {({ state }) => (
          <Dialog className={dialogPanelClassName}>
            <div className="flex items-center justify-between border-(--color-divider) border-b pb-3">
              <h2 className="text-h5">New project</h2>
              <Button
                aria-label="Close"
                onPress={state.close}
                className="flex h-6 w-6 items-center justify-center text-(--color-text-muted) data-[hovered]:text-(--color-text) data-[focus-visible]:outline-2 data-[focus-visible]:outline-(--color-accent)">
                <CloseIcon size={16} />
              </Button>
            </div>
            <CreateProjectForm
              createProjectAction={createProjectAction}
              checkKeyAvailability={checkKeyAvailability}
              candidates={candidates}
              onCancel={state.close}
            />
          </Dialog>
        )}
      </Modal>
    </DialogTrigger>
  );
}