"use client";

import type { DeleteLabelResult } from "../server/delete-label";
import type { LabelView } from "../server/queries";
import type { CheckLabelNameAvailable, CreateLabelAction, UpdateLabelAction } from "./label-form-modal";
import { LabelFormModal } from "./label-form-modal";
import { LabelRow } from "./label-row";

export function LabelsScreen({
  labels,
  createLabelAction,
  updateLabelAction,
  checkNameAvailable,
  deleteLabelAction,
}: {
  labels: LabelView[];
  createLabelAction: CreateLabelAction;
  updateLabelAction: UpdateLabelAction;
  checkNameAvailable: CheckLabelNameAvailable;
  deleteLabelAction: (id: string) => Promise<DeleteLabelResult>;
}) {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex justify-end">
        <LabelFormModal
          createLabelAction={createLabelAction}
          updateLabelAction={updateLabelAction}
          checkNameAvailable={checkNameAvailable}
        />
      </div>
      {labels.length === 0 ? (
        <p className="text-label text-(--color-text-muted)">No labels yet</p>
      ) : (
        <table>
          <thead>
            <tr className="border-b border-(--color-divider)">
              <th className="px-2 py-1 text-label text-(--color-text-muted)">Name</th>
              <th className="px-2 py-1 text-label text-(--color-text-muted)">Issues</th>
              <th className="px-2 py-1 text-label text-(--color-text-muted)">Edit</th>
              <th className="px-2 py-1 text-label text-(--color-text-muted)">Delete</th>
            </tr>
          </thead>
          <tbody>
            {labels.map((label) => (
              <LabelRow
                key={label.id}
                label={label}
                createLabelAction={createLabelAction}
                updateLabelAction={updateLabelAction}
                checkNameAvailable={checkNameAvailable}
                deleteLabelAction={deleteLabelAction}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}