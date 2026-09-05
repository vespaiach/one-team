"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "react-aria-components/Button";
import { GridList, GridListItem } from "react-aria-components/GridList";
import { useDragAndDrop } from "react-aria-components/useDragAndDrop";
import type {
  CreateColumnState,
  DeleteColumnState,
  MoveColumnState,
  UpdateColumnState,
} from "../column-actions";
import type { ProjectColumnRow } from "../server/queries";
import { AddColumnForm } from "./add-column-form";
import { ColumnRow } from "./column-row";

const REORDER_REFUSAL_MESSAGES: Record<Exclude<MoveColumnState, { ok: true }>["error"], string> = {
  forbidden: "That column wasn't moved — only an admin can reorder a project's columns.",
  not_found: "That column wasn't moved — it has already been deleted. The list has been refreshed.",
  invalid_target:
    "That column wasn't moved — a column can only be reordered among its own project's columns.",
  invalid_input: "That column wasn't moved — that drop wasn't understood. Try the drag again.",
};

const REORDER_FAILED_MESSAGE = "That column wasn't moved. Try again.";

function spliceColumn(
  columns: ProjectColumnRow[],
  movedId: string,
  targetId: string,
  placement: "before" | "after",
): ProjectColumnRow[] {
  const moved = columns.filter((column) => column.id === movedId);
  return columns.flatMap((column) => {
    if (column.id === movedId) {
      return [];
    }
    if (column.id !== targetId) {
      return [column];
    }
    return placement === "before" ? [...moved, column] : [column, ...moved];
  });
}

export type ColumnsSectionAdmin = {
  projectKey: string;
  createColumn: (input: { projectKey: string; name: string }) => Promise<CreateColumnState>;
  updateColumn: (input: { columnId: string; name: string }) => Promise<UpdateColumnState>;
  moveColumn: (input: {
    columnId: string;
    targetColumnId: string;
    placement: "before" | "after";
  }) => Promise<MoveColumnState>;
  deleteColumn: (input: { columnId: string }) => Promise<DeleteColumnState>;
};

export function ColumnsSection({
  columns,
  admin,
}: {
  columns: ProjectColumnRow[];
  admin?: ColumnsSectionAdmin;
}) {
  const router = useRouter();
  const messageId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const [serverColumns, setServerColumns] = useState(columns);
  const [reorderedColumns, setReorderedColumns] = useState<ProjectColumnRow[] | null>(null);
  const [reorderMessage, setReorderMessage] = useState<string | null>(null);

  if (serverColumns !== columns) {
    setServerColumns(columns);
    setReorderedColumns(null);
  }

  const rows = reorderedColumns ?? columns;

  useEffect(() => {
    const list = listRef.current;
    if (list === null) {
      return;
    }
    if (reorderMessage === null) {
      list.removeAttribute("aria-describedby");
      return;
    }
    list.setAttribute("aria-describedby", messageId);
  }, [reorderMessage, messageId]);

  const { dragAndDropHooks } = useDragAndDrop({
    getItems: (keys) => [...keys].map((key) => ({ "text/plain": String(key) })),
    onReorder: ({ keys, target }) => {
      const moveColumn = admin?.moveColumn;
      const movedId = [...keys].map(String)[0];
      if (!moveColumn || movedId === undefined) {
        return;
      }
      const targetColumnId = String(target.key);
      const placement = target.dropPosition === "before" ? "before" : "after";

      setReorderedColumns(spliceColumn(rows, movedId, targetColumnId, placement));
      setReorderMessage(null);

      moveColumn({ columnId: movedId, targetColumnId, placement }).then(
        (result) => {
          if (result.ok) {
            return;
          }
          setReorderedColumns(null);
          setReorderMessage(REORDER_REFUSAL_MESSAGES[result.error]);
          if (result.error === "not_found") {
            router.refresh();
          }
        },
        () => {
          setReorderedColumns(null);
          setReorderMessage(REORDER_FAILED_MESSAGE);
        },
      );
    },
  });

  return (
    <div className="flex flex-col gap-3">
      <GridList
        key={admin ? "admin" : "read-only"}
        ref={listRef}
        aria-label="Columns"
        items={rows}
        dragAndDropHooks={admin ? dragAndDropHooks : undefined}
        className="flex flex-col">
        {(column) => (
          <GridListItem
            id={column.id}
            textValue={column.name}
            className="border-(--color-divider) border-b px-2 py-2 data-[focus-visible]:outline-2 data-[focus-visible]:outline-(--color-accent)">
            {admin ? (
              <Button
                slot="drag"
                className="px-1 text-(--color-text-muted) data-[focus-visible]:outline-2 data-[focus-visible]:outline-(--color-accent)">
                ⠿
              </Button>
            ) : null}
            <ColumnRow
              column={column}
              updateColumn={admin?.updateColumn}
              deleteColumn={admin?.deleteColumn}
            />
          </GridListItem>
        )}
      </GridList>
      {reorderMessage ? (
        <p
          id={messageId}
          role="alert"
          className="text-control text-(--color-danger-text)">
          {reorderMessage}
        </p>
      ) : null}
      {admin ? (
        <AddColumnForm
          projectKey={admin.projectKey}
          createColumn={admin.createColumn}
        />
      ) : null}
    </div>
  );
}