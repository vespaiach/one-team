import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { project } from "@/db/schema";

export type DeleteProjectResult =
  | { status: "deleted" }
  | { status: "not_archived" }
  | { status: "not_found" };

export async function deleteProject(projectId: string): Promise<DeleteProjectResult> {
  return await db.transaction(async (tx) => {
    const [row] = await tx
      .select({ status: project.status })
      .from(project)
      .where(eq(project.id, projectId))
      .for("update");

    if (!row) {
      return { status: "not_found" };
    }
    if (row.status !== "archived") {
      return { status: "not_archived" };
    }

    await tx.delete(project).where(eq(project.id, projectId));
    return { status: "deleted" };
  });
}