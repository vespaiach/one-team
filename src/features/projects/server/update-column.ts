import "server-only";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { boardColumn } from "@/db/schema";
import { touched } from "@/db/touched";
import { writeActivity } from "@/features/activity/server/write-activity";
import type { Actor } from "@/features/auth/server/actor";
import { isAdmin } from "./authorization";
import { parseColumnName } from "./column-name";
import { findColumnNameHolder, isColumnNameConflict } from "./create-column";

export type UpdateColumnInput = {
  actor: Actor;
  columnId: string;
  name: string;
};

export type UpdateColumnResult =
  | { ok: true }
  | { ok: false; error: "forbidden" }
  | { ok: false; error: "invalid_name"; reason: "required" | "too_long" }
  | { ok: false; error: "duplicate_name"; holder: { id: string; name: string } };

export async function updateColumn(input: UpdateColumnInput): Promise<UpdateColumnResult> {
  const [columnRow] = await db.select().from(boardColumn).where(eq(boardColumn.id, input.columnId));
  if (!columnRow) {
    notFound();
  }

  if (!isAdmin(input.actor)) {
    return { ok: false, error: "forbidden" };
  }

  const parsed = parseColumnName(input.name);
  if (!parsed.ok) {
    return { ok: false, error: "invalid_name", reason: parsed.reason };
  }

  try {
    await db.transaction(async (tx) => {
      const [locked] = await tx
        .select()
        .from(boardColumn)
        .where(eq(boardColumn.id, input.columnId))
        .for("update");
      if (!locked) {
        notFound();
      }

      if (parsed.name === locked.name) {
        return;
      }

      await tx
        .update(boardColumn)
        .set(touched({ name: parsed.name }))
        .where(eq(boardColumn.id, input.columnId));

      await writeActivity(tx, {
        type: "column_renamed",
        target: { projectId: locked.projectId },
        actorId: input.actor.id,
        field: locked.name,
        fromValue: locked.name,
        toValue: parsed.name,
      });
    });
  } catch (error) {
    if (isColumnNameConflict(error)) {
      const holder = await findColumnNameHolder(columnRow.projectId, parsed.name);
      if (holder) {
        return { ok: false, error: "duplicate_name", holder };
      }
    }
    throw error;
  }

  return { ok: true };
}