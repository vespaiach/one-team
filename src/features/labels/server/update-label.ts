import "server-only";
import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { issueLabel, label } from "@/db/schema";
import { touched } from "@/db/touched";
import { isUniqueViolation } from "@/db/unique-violation";
import type { Actor } from "@/features/auth/server/actor";
import { isAdmin } from "@/features/projects/server/authorization";
import { findLabelNameHolder } from "./create-label";
import type { LabelView } from "./queries";

const MAX_NAME_LENGTH = 200;

export type UpdateLabelInput = {
  actor: Actor;
  id: string;
  name: string;
};

export type UpdateLabelResult =
  | { ok: true; label: LabelView }
  | { ok: false; error: "forbidden" }
  | { ok: false; error: "invalid_name" }
  | { ok: false; error: "not_found" }
  | { ok: false; error: "duplicate_name"; holder: { id: string; name: string } };

export async function updateLabel(input: UpdateLabelInput): Promise<UpdateLabelResult> {
  if (!isAdmin(input.actor)) {
    return { ok: false, error: "forbidden" };
  }

  const name = input.name.trim();
  if (name === "" || name.length > MAX_NAME_LENGTH) {
    return { ok: false, error: "invalid_name" };
  }

  const [existing] = await db.select({ id: label.id }).from(label).where(eq(label.id, input.id));
  if (!existing) {
    return { ok: false, error: "not_found" };
  }

  const holder = await findLabelNameHolder(name, input.id);
  if (holder) {
    return { ok: false, error: "duplicate_name", holder };
  }

  try {
    const updated = await db.transaction(async (tx) => {
      const [row] = await tx.update(label).set(touched({ name })).where(eq(label.id, input.id)).returning();
      return row ?? null;
    });

    if (!updated) {
      return { ok: false, error: "not_found" };
    }

    const [usage] = await db
      .select({ value: count() })
      .from(issueLabel)
      .where(eq(issueLabel.labelId, updated.id));

    return {
      ok: true,
      label: { id: updated.id, name: updated.name, issueCount: usage?.value ?? 0 },
    };
  } catch (error) {
    if (isUniqueViolation(error)) {
      const raced = await findLabelNameHolder(name, input.id);
      if (raced) {
        return { ok: false, error: "duplicate_name", holder: raced };
      }
    }
    throw error;
  }
}