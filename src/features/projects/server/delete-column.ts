import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { boardColumn } from "@/db/schema";
import { writeActivity } from "@/features/activity/server/write-activity";
import type { Actor } from "@/features/auth/server/actor";
import { isAdmin } from "./authorization";
import { type ColumnDeleteRefusal, selectColumnDeleteRefusal } from "./column-delete-refusal";
import { countIssuesByColumn } from "./column-queries";

export type DeleteColumnInput = {
  actor: Actor;
  projectId: string;
  columnId: string;
};

export type DeleteColumnState =
  | { ok: true }
  | { ok: false; error: "forbidden" }
  | { ok: false; error: "not_found" }
  | { ok: false; error: "refused"; refusal: ColumnDeleteRefusal };

export async function deleteColumn(input: DeleteColumnInput): Promise<DeleteColumnState> {
  if (!isAdmin(input.actor)) {
    return { ok: false, error: "forbidden" };
  }

  return db.transaction(async (tx) => {
    const columns = await tx
      .select({ id: boardColumn.id, name: boardColumn.name, kind: boardColumn.kind })
      .from(boardColumn)
      .where(eq(boardColumn.projectId, input.projectId))
      .orderBy(asc(boardColumn.id))
      .for("update");

    const target = columns.find((column) => column.id === input.columnId);
    if (!target) {
      return { ok: false, error: "not_found" };
    }

    const issueCounts = await countIssuesByColumn(tx, input.projectId);

    const refusal = selectColumnDeleteRefusal({
      holdsIssues: (issueCounts.get(target.id) ?? 0) > 0,
      isLastColumn: columns.length === 1,
      isLastCanceledKind:
        target.kind === "canceled" && columns.filter((column) => column.kind === "canceled").length === 1,
      isLastDoneKind:
        target.kind === "done" && columns.filter((column) => column.kind === "done").length === 1,
    });
    if (refusal !== null) {
      return { ok: false, error: "refused", refusal };
    }

    await tx.delete(boardColumn).where(eq(boardColumn.id, target.id));

    await writeActivity(tx, {
      type: "column_deleted",
      target: { projectId: input.projectId },
      actorId: input.actor.id,
      field: target.name,
    });

    return { ok: true };
  });
}