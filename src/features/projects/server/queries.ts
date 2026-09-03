import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { project, projectMember } from "@/db/schema";

export async function hasProjectMemberRow(projectId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ projectId: projectMember.projectId })
    .from(projectMember)
    .where(and(eq(projectMember.projectId, projectId), eq(projectMember.userId, userId)));
  return row !== undefined;
}

export async function loadProjectByKey(key: string): Promise<typeof project.$inferSelect | null> {
  const [row] = await db.select().from(project).where(eq(project.key, key));
  return row ?? null;
}