import type { DeleteLabelResult } from "../server/delete-label";
import type { LabelView } from "../server/queries";
import { DeleteLabelDialog } from "./delete-label-dialog";
import type { CheckLabelNameAvailable, CreateLabelAction, UpdateLabelAction } from "./label-form-modal";
import { LabelFormModal } from "./label-form-modal";

export function LabelRow({
  label,
  createLabelAction,
  updateLabelAction,
  checkNameAvailable,
  deleteLabelAction,
}: {
  label: LabelView;
  createLabelAction: CreateLabelAction;
  updateLabelAction: UpdateLabelAction;
  checkNameAvailable: CheckLabelNameAvailable;
  deleteLabelAction: (id: string) => Promise<DeleteLabelResult>;
}) {
  return (
    <tr className="border-b border-(--color-divider)">
      <td className="px-2 py-1.5 text-control text-(--color-text)">{label.name}</td>
      <td className="px-2 py-1.5 text-control font-mono text-(--color-text)">{label.issueCount}</td>
      <td className="px-2 py-1.5">
        <LabelFormModal
          label={label}
          createLabelAction={createLabelAction}
          updateLabelAction={updateLabelAction}
          checkNameAvailable={checkNameAvailable}
        />
      </td>
      <td className="px-2 py-1.5">
        <DeleteLabelDialog
          labelId={label.id}
          labelName={label.name}
          issueCount={label.issueCount}
          deleteLabelAction={deleteLabelAction}
        />
      </td>
    </tr>
  );
}