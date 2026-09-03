import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { project, projectMember } from "@/db/schema";
import { touched } from "@/db/touched";

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
      const [row] = await tx.select().from(project).where(eq(project.id, projectId));
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

      await tx.update(project).set(touched(fields)).where(eq(project.id, projectId));
      return { status: "saved" };
    });
  } catch (error) {
    if (isDateOrderViolation(error)) {
      return { status: "invalid", field: "targetDate", reason: "before_start" };
    }
    throw error;
  }
}