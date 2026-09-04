import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { project, projectMember } from "@/db/schema";
import { touched } from "@/db/touched";
import { truncateActivityValue, writeActivity } from "@/features/activity/server/write-activity";

export type UpdateProjectChanges = Partial<{
  name: string;
  description: string | null;
  startDate: string | null;
  targetDate: string | null;
}>;

export type UpdateProjectResult =
  | { status: "saved" }
  | { status: "invalid"; field: "name" | "description" | "startDate" | "targetDate"; reason: string }
  | { status: "forbidden" }
  | { status: "not_found" };

const DATE_ORDER_CONSTRAINT = "project_dates_ordered";

function isDateOrderViolation(error: unknown): boolean {
  const candidate = error instanceof Error ? error.cause : error;
  return (
    typeof candidate === "object" &&
    candidate !== null &&
    "code" in candidate &&
    candidate.code === "23514" &&
    "constraint_name" in candidate &&
    candidate.constraint_name === DATE_ORDER_CONSTRAINT
  );
}

export async function updateProject(
  projectId: string,
  actor: { id: string; role: string },
  changes: UpdateProjectChanges,
): Promise<UpdateProjectResult> {
  try {
    return await db.transaction(async (tx) => {
      const [row] = await tx.select().from(project).where(eq(project.id, projectId)).for("update");
      if (!row) {
        return { status: "not_found" };
      }

      if (actor.role !== "admin") {
        const [membership] = await tx
          .select({ projectId: projectMember.projectId })
          .from(projectMember)
          .where(and(eq(projectMember.projectId, projectId), eq(projectMember.userId, actor.id)));
        if (!membership) {
          return { status: "forbidden" };
        }
      }

      if ("startDate" in changes || "targetDate" in changes) {
        const startDate = "startDate" in changes ? changes.startDate : row.startDate;
        const targetDate = "targetDate" in changes ? changes.targetDate : row.targetDate;
        if (startDate && targetDate && targetDate < startDate) {
          return { status: "invalid", field: "targetDate", reason: "before_start" };
        }
      }

      const fields: Partial<typeof project.$inferInsert> = {};
      if ("name" in changes && changes.name !== undefined) {
        fields.name = changes.name;
      }
      if ("description" in changes) {
        fields.description = changes.description ?? null;
      }
      if ("startDate" in changes) {
        fields.startDate = changes.startDate ?? null;
      }
      if ("targetDate" in changes) {
        fields.targetDate = changes.targetDate ?? null;
      }

      const diffs: {
        field: "name" | "description" | "start_date" | "target_date";
        from: string | null;
        to: string | null;
      }[] = [];
      if ("name" in fields && fields.name !== row.name) {
        diffs.push({ field: "name", from: row.name, to: fields.name ?? null });
      }
      if ("description" in fields && fields.description !== row.description) {
        diffs.push({ field: "description", from: row.description, to: fields.description ?? null });
      }
      if ("startDate" in fields && fields.startDate !== row.startDate) {
        diffs.push({ field: "start_date", from: row.startDate, to: fields.startDate ?? null });
      }
      if ("targetDate" in fields && fields.targetDate !== row.targetDate) {
        diffs.push({ field: "target_date", from: row.targetDate, to: fields.targetDate ?? null });
      }

      if (diffs.length === 0) {
        return { status: "saved" };
      }

      await tx.update(project).set(touched(fields)).where(eq(project.id, projectId));

      for (const diff of diffs) {
        await writeActivity(tx, {
          type: "field_changed",
          target: { projectId },
          actorId: actor.id,
          field: diff.field,
          fromValue: truncateActivityValue(diff.from),
          toValue: truncateActivityValue(diff.to),
        });
      }

      return { status: "saved" };
    });
  } catch (error) {
    if (isDateOrderViolation(error)) {
      return { status: "invalid", field: "targetDate", reason: "before_start" };
    }
    throw error;
  }
}