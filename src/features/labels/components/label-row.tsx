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
    <tr className="border-b border-(--color-divider) hover:bg-(--color-surface-hover)">
      <td className="px-3 py-2">
        <span className="inline-flex items-center rounded-[var(--radius-sm)] border border-(--color-divider) px-1.5 py-0.5 text-label text-(--color-text-muted)">
          {label.name}
        </span>
      </td>
      <td className="px-3 py-2 font-mono">{label.issueCount}</td>
      <td className="px-3 py-2">
        <LabelFormModal
          label={label}
          createLabelAction={createLabelAction}
          updateLabelAction={updateLabelAction}
          checkNameAvailable={checkNameAvailable}
        />
      </td>
      <td className="px-3 py-2">
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