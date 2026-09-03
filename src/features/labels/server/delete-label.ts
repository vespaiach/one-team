import "server-only";
import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { issueLabel, label } from "@/db/schema";
import type { Actor } from "@/features/auth/server/actor";
import { isAdmin } from "@/features/projects/server/authorization";

export type DeleteLabelInput = {
  actor: Actor;
  id: string;
};

export type DeleteLabelResult =
  | { ok: true; removedFromIssueCount: number }
  | { ok: false; error: "forbidden" }
  | { ok: false; error: "not_found" };

export async function deleteLabel(input: DeleteLabelInput): Promise<DeleteLabelResult> {
  if (!isAdmin(input.actor)) {
    return { ok: false, error: "forbidden" };
  }

  return db.transaction(async (tx) => {
    const [existing] = await tx.select({ id: label.id }).from(label).where(eq(label.id, input.id));
    if (!existing) {
      return { ok: false, error: "not_found" };
    }

    const [usage] = await tx
      .select({ value: count() })
      .from(issueLabel)
      .where(eq(issueLabel.labelId, input.id));

    await tx.delete(label).where(eq(label.id, input.id));

    return { ok: true, removedFromIssueCount: usage?.value ?? 0 };
  });
}