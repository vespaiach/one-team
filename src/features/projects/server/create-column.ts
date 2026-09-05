import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { generateKeyBetween } from "fractional-indexing";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { boardColumn } from "@/db/schema";
import { touched } from "@/db/touched";
import { isUniqueViolation } from "@/db/unique-violation";
import { writeActivity } from "@/features/activity/server/write-activity";
import type { Actor } from "@/features/auth/server/actor";
import { isAdmin } from "./authorization";
import { selectColumnDeleteRefusal } from "./column-delete-refusal";
import { parseColumnName } from "./column-name";
import { loadProjectByKey, type ProjectColumnRow } from "./queries";

export type CreateColumnInput = {
  actor: Actor;
  projectKey: string;
  name: string;
};

export type CreateColumnResult =
  | { ok: true; column: ProjectColumnRow }
  | { ok: false; error: "forbidden" }
  | { ok: false; error: "invalid_name"; reason: "required" | "too_long" }
  | { ok: false; error: "duplicate_name"; holder: { id: string; name: string } };

const COLUMN_NAME_CONSTRAINT = "board_column_project_id_name_lower_idx";

function violatedConstraintName(error: unknown): string | null {
  if (typeof error === "object" && error !== null && "constraint_name" in error) {
    const { constraint_name: name } = error;
    if (typeof name === "string") {
      return name;
    }
  }
  return error instanceof Error ? violatedConstraintName(error.cause) : null;
}

export function isColumnNameConflict(error: unknown): boolean {
  return isUniqueViolation(error) && violatedConstraintName(error) === COLUMN_NAME_CONSTRAINT;
}

export async function findColumnNameHolder(
  projectId: string,
  name: string,
): Promise<{ id: string; name: string } | null> {
  const [row] = await db
    .select({ id: boardColumn.id, name: boardColumn.name })
    .from(boardColumn)
    .where(and(eq(boardColumn.projectId, projectId), sql`lower(${boardColumn.name}) = lower(${name})`));
  return row ?? null;
}

export async function createColumn(input: CreateColumnInput): Promise<CreateColumnResult> {
  const projectRow = await loadProjectByKey(input.projectKey);
  if (!projectRow) {
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
    const created = await db.transaction(async (tx) => {
      const [highest] = await tx
        .select({ sortOrder: boardColumn.sortOrder })
        .from(boardColumn)
        .where(eq(boardColumn.projectId, projectRow.id))
        .orderBy(desc(boardColumn.sortOrder), desc(boardColumn.id))
        .limit(1)
        .for("update");

      const [row] = await tx
        .insert(boardColumn)
        .values(
          touched({
            projectId: projectRow.id,
            name: parsed.name,
            kind: "open",
            sortOrder: generateKeyBetween(highest?.sortOrder ?? null, null),
            createdAt: new Date(),
          }),
        )
        .returning();
      if (!row) {
        throw new Error("createColumn produced no board_column row");
      }

      const [counted] = await tx
        .select({ total: sql<number>`count(*)::int` })
        .from(boardColumn)
        .where(eq(boardColumn.projectId, projectRow.id));

      await writeActivity(tx, {
        type: "column_added",
        target: { projectId: projectRow.id },
        actorId: input.actor.id,
        field: parsed.name,
      });

      return { row, position: (counted?.total ?? 1) - 1 };
    });

    return {
      ok: true,
      column: {
        id: created.row.id,
        name: created.row.name,
        kind: "open",
        position: created.position,
        issueCount: 0,
        deleteRefusal: selectColumnDeleteRefusal({
          holdsIssues: false,
          isLastColumn: created.position === 0,
          isLastCanceledKind: false,
          isLastDoneKind: false,
        }),
      },
    };
  } catch (error) {
    if (isColumnNameConflict(error)) {
      const holder = await findColumnNameHolder(projectRow.id, parsed.name);
      if (holder) {
        return { ok: false, error: "duplicate_name", holder };
      }
    }
    throw error;
  }
}