"use client";

import { Button } from "react-aria-components/Button";
import { Dialog, DialogTrigger } from "react-aria-components/Dialog";
import { Link } from "react-aria-components/Link";
import { Modal } from "react-aria-components/Modal";
import { dialogPanelCompactClassName } from "@/components/shared/dialog-panel";

export type NewIssueProjectPickerEntry = {
  key: string;
  name: string;
  status: "active" | "archived";
};

export function NewIssueProjectPicker({ projects }: { projects: NewIssueProjectPickerEntry[] }) {
  return (
    <DialogTrigger>
      <Button className="text-control text-(--color-accent) hover:underline">New issue</Button>
      <Modal
        isDismissable
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <Dialog className={dialogPanelCompactClassName}>
          <h2 className="text-h5">New issue</h2>
          <p className="text-label text-(--color-text-muted)">Pick the project this issue belongs to.</p>
          {projects.length === 0 ? (
            <p className="text-control text-(--color-text-muted)">No projects yet.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-(--color-divider)">
              {projects.map((project) => (
                <li key={project.key}>
                  <Link
                    href={`/projects/${project.key}?newIssue=1`}
                    className={`block py-2 text-control ${
                      project.status === "archived"
                        ? "text-(--color-text-muted)"
                        : "text-(--color-text) hover:underline"
                    }`}>
                    {project.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Dialog>
      </Modal>
    </DialogTrigger>
  );
}