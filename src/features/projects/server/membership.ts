import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { projectMember } from "@/db/schema";

export async function addProjectMember(projectId: string, userId: string): Promise<void> {
  const now = new Date();
  await db.insert(projectMember).values({ projectId, userId, createdAt: now, updatedAt: now });
}

export async function removeProjectMember(projectId: string, userId: string): Promise<void> {
  await db
    .delete(projectMember)
    .where(and(eq(projectMember.projectId, projectId), eq(projectMember.userId, userId)));
}