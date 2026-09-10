"use client";

import type { ReactNode } from "react";
import { Button } from "react-aria-components/Button";
import { Dialog, DialogTrigger } from "react-aria-components/Dialog";
import { Modal } from "react-aria-components/Modal";
import { dialogPanelClassName } from "@/components/shared/dialog-panel";
import type { CreateProjectPayload, CreateProjectState } from "../actions";
import type { RosterEntry } from "../server/queries";
import { CreateProjectForm } from "./create-project-form";

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
            <h2 className="text-h5">New project</h2>
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