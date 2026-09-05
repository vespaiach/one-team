import "server-only";
import { eq } from "drizzle-orm";
import { generateKeyBetween } from "fractional-indexing";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { boardColumn } from "@/db/schema";
import { touched } from "@/db/touched";
import { writeActivity } from "@/features/activity/server/write-activity";
import type { Actor } from "@/features/auth/server/actor";
import { isAdmin } from "./authorization";
import { parseColumnId, parsePlacement } from "./column-input";

export type MoveColumnInput = {
  actor: Actor;
  columnId: unknown;
  targetColumnId: unknown;
  placement: unknown;
};

export type MoveColumnState =
  | { ok: true }
  | { ok: false; error: "forbidden" }
  | { ok: false; error: "not_found" }
  | { ok: false; error: "invalid_target" }
  | { ok: false; error: "invalid_input" };

type LockedColumn = { id: string; name: string; sortOrder: string };

function byBoardOrder(left: LockedColumn, right: LockedColumn): number {
  if (left.sortOrder !== right.sortOrder) {
    return left.sortOrder < right.sortOrder ? -1 : 1;
  }
  return left.id < right.id ? -1 : 1;
}

export async function moveColumn(input: MoveColumnInput): Promise<MoveColumnState> {
  const movedId = parseColumnId(input.columnId);
  if (movedId === null) {
    notFound();
  }

  const [subject] = await db
    .select({ projectId: boardColumn.projectId })
    .from(boardColumn)
    .where(eq(boardColumn.id, movedId));
  if (!subject) {
    notFound();
  }

  if (!isAdmin(input.actor)) {
    return { ok: false, error: "forbidden" };
  }

  const targetId = parseColumnId(input.targetColumnId);
  if (targetId === null) {
    return { ok: false, error: "not_found" };
  }

  const placement = parsePlacement(input.placement);
  if (placement === null) {
    return { ok: false, error: "invalid_input" };
  }

  return db.transaction(async (tx): Promise<MoveColumnState> => {
    const locked = await tx
      .select({ id: boardColumn.id, name: boardColumn.name, sortOrder: boardColumn.sortOrder })
      .from(boardColumn)
      .where(eq(boardColumn.projectId, subject.projectId))
      .orderBy(boardColumn.id)
      .for("update");

    const moved = locked.find((column) => column.id === movedId);
    if (!moved) {
      return { ok: false, error: "not_found" };
    }

    const target = locked.find((column) => column.id === targetId);
    if (!target) {
      const [elsewhere] = await tx
        .select({ id: boardColumn.id })
        .from(boardColumn)
        .where(eq(boardColumn.id, targetId));
      return elsewhere ? { ok: false, error: "invalid_target" } : { ok: false, error: "not_found" };
    }

    const ordered = [...locked].sort(byBoardOrder);
    const reordered: LockedColumn[] = [];
    for (const column of ordered) {
      if (column.id === target.id && placement === "before") {
        reordered.push(moved);
      }
      if (column.id !== moved.id) {
        reordered.push(column);
      }
      if (column.id === target.id && placement === "after") {
        reordered.push(moved);
      }
    }

    const index = reordered.indexOf(moved);
    if (index === ordered.indexOf(moved)) {
      return { ok: true };
    }

    const previous = reordered[index - 1];
    const next = reordered[index + 1];

    await tx
      .update(boardColumn)
      .set(touched({ sortOrder: generateKeyBetween(previous?.sortOrder ?? null, next?.sortOrder ?? null) }))
      .where(eq(boardColumn.id, moved.id));

    await writeActivity(tx, {
      type: "column_reordered",
      target: { projectId: subject.projectId },
      actorId: input.actor.id,
      field: moved.name,
      toValue: previous?.name ?? null,
    });

    return { ok: true };
  });
}