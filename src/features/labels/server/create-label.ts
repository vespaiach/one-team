import "server-only";
import { and, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { label } from "@/db/schema";
import { isUniqueViolation } from "@/db/unique-violation";
import type { Actor } from "@/features/auth/server/actor";
import { isAdmin } from "@/features/projects/server/authorization";
import type { LabelView } from "./queries";

const MAX_NAME_LENGTH = 200;

export type CreateLabelInput = {
  actor: Actor;
  name: string;
};

export type CreateLabelResult =
  | { ok: true; label: LabelView }
  | { ok: false; error: "forbidden" }
  | { ok: false; error: "invalid_name" }
  | { ok: false; error: "duplicate_name"; holder: { id: string; name: string } };

export async function findLabelNameHolder(
  name: string,
  excludeId?: string,
): Promise<{ id: string; name: string } | null> {
  const conditions = [sql`lower(${label.name}) = lower(${name})`];
  if (excludeId) {
    conditions.push(ne(label.id, excludeId));
  }
  const [row] = await db
    .select({ id: label.id, name: label.name })
    .from(label)
    .where(and(...conditions));
  return row ?? null;
}

export async function createLabel(input: CreateLabelInput): Promise<CreateLabelResult> {
  if (!isAdmin(input.actor)) {
    return { ok: false, error: "forbidden" };
  }

  const name = input.name.trim();
  if (name === "" || name.length > MAX_NAME_LENGTH) {
    return { ok: false, error: "invalid_name" };
  }

  const holder = await findLabelNameHolder(name);
  if (holder) {
    return { ok: false, error: "duplicate_name", holder };
  }

  try {
    const now = new Date();
    const created = await db.transaction(async (tx) => {
      const [row] = await tx.insert(label).values({ name, createdAt: now, updatedAt: now }).returning();
      if (!row) {
        throw new Error("createLabel produced no label row");
      }
      return row;
    });

    return { ok: true, label: { id: created.id, name: created.name, issueCount: 0 } };
  } catch (error) {
    if (isUniqueViolation(error)) {
      const raced = await findLabelNameHolder(name);
      if (raced) {
        return { ok: false, error: "duplicate_name", holder: raced };
      }
    }
    throw error;
  }
}