"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Button } from "react-aria-components/Button";
import type { DeleteColumnState, UpdateColumnState } from "../column-actions";
import type { ColumnDeleteRefusal } from "../server/column-delete-refusal";
import type { ProjectColumnRow } from "../server/queries";
import { DeleteColumnDialog } from "./delete-column-dialog";
import { EditableField, type EditableFieldSaveResult } from "./editable-field";

const DELETE_REFUSAL_MESSAGES: Record<ColumnDeleteRefusal, string> = {
  holds_issues: "This column still holds issues. Move them to another column before deleting it.",
  last_column: "This is the project's last column, and a project always has at least one.",
  last_canceled_kind:
    "This is the project's last canceled column, and it's a member's only way to remove an issue.",
  last_done_kind:
    "This is the project's last done column, so no work could be counted as done — and a column's kind can't be changed afterwards.",
};

type DeleteColumnFailure = Exclude<DeleteColumnState, { ok: true }>;

const DELETE_FAILURE_MESSAGES: Record<Exclude<DeleteColumnFailure["error"], "refused">, string> = {
  forbidden: "That column wasn't deleted — only an admin can delete a project's columns.",
  not_found: "That column wasn't deleted — it has already been deleted. The list has been refreshed.",
};

function toDeleteFailureMessage(failure: DeleteColumnFailure): string {
  return failure.error === "refused"
    ? DELETE_REFUSAL_MESSAGES[failure.refusal]
    : DELETE_FAILURE_MESSAGES[failure.error];
}

function ColumnDeleteControl({
  column,
  deleteColumn,
}: {
  column: ProjectColumnRow;
  deleteColumn: (input: { columnId: string }) => Promise<DeleteColumnState>;
}) {
  const refusalId = useId();
  const router = useRouter();
  const [failureMessage, setFailureMessage] = useState<string | null>(null);

  if (column.deleteRefusal === null) {
    return (
      <div className="flex flex-col gap-1">
        <DeleteColumnDialog
          columnName={column.name}
          describedById={failureMessage === null ? undefined : refusalId}
          onDelete={async () => {
            const result = await deleteColumn({ columnId: column.id });
            if (result.ok) {
              return;
            }
            setFailureMessage(toDeleteFailureMessage(result));
            if (result.error === "not_found") {
              router.refresh();
            }
          }}
        />
        {failureMessage === null ? null : (
          <p
            id={refusalId}
            role="alert"
            className="text-control text-(--color-danger-text)">
            {failureMessage}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        isDisabled
        aria-describedby={refusalId}
        className="data-[focus-visible]:outline-2 data-[focus-visible]:outline-(--color-accent)">
        Delete
      </Button>
      <p
        id={refusalId}
        className="text-control text-(--color-text-muted)">
        {DELETE_REFUSAL_MESSAGES[column.deleteRefusal]}
      </p>
    </div>
  );
}

function toSaveResult(state: UpdateColumnState): EditableFieldSaveResult {
  if (state.ok) {
    return { status: "saved" };
  }
  switch (state.error) {
    case "duplicate_name":
      return {
        status: "conflict",
        message: `That name is already taken by the column ${state.holder.name}.`,
      };
    case "forbidden":
      return {
        status: "conflict",
        message: "That rename wasn't saved — only an admin can rename a project's columns.",
      };
    default:
      return { status: "invalid", reason: state.reason };
  }
}

export function ColumnRow({
  column,
  updateColumn,
  deleteColumn,
}: {
  column: ProjectColumnRow;
  updateColumn?: (input: { columnId: string; name: string }) => Promise<UpdateColumnState>;
  deleteColumn?: (input: { columnId: string }) => Promise<DeleteColumnState>;
}) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex-1">
        {updateColumn ? (
          <EditableField
            label="Column name"
            value={column.name}
            onSave={async (nextValue) =>
              toSaveResult(await updateColumn({ columnId: column.id, name: nextValue }))
            }
          />
        ) : (
          <span className="text-control text-(--color-text)">{column.name}</span>
        )}
      </div>
      <span className="text-control text-(--color-text-muted)">{column.kind}</span>
      <span className="text-control text-(--color-text-muted)">{column.issueCount}</span>
      {deleteColumn ? (
        <ColumnDeleteControl
          column={column}
          deleteColumn={deleteColumn}
        />
      ) : null}
    </div>
  );
}