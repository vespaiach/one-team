import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { projectMember, user } from "@/db/schema";
import { writeActivity } from "@/features/activity/server/write-activity";

async function loadDisplayName(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], userId: string) {
  const [row] = await tx
    .select({ firstName: user.firstName, lastName: user.lastName })
    .from(user)
    .where(eq(user.id, userId));
  if (!row) {
    throw new Error(`membership: user ${userId} not found`);
  }
  return `${row.firstName} ${row.lastName}`;
}

export async function addProjectMember(projectId: string, userId: string, actorId?: string): Promise<void> {
  await db.transaction(async (tx) => {
    const now = new Date();
    await tx.insert(projectMember).values({ projectId, userId, createdAt: now, updatedAt: now });

    if (actorId) {
      const displayName = await loadDisplayName(tx, userId);
      await writeActivity(tx, {
        type: "member_added",
        target: { projectId },
        actorId,
        toValue: displayName,
      });
    }
  });
}

export async function removeProjectMember(
  projectId: string,
  userId: string,
  actorId?: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const displayName = actorId ? await loadDisplayName(tx, userId) : null;

    await tx
      .delete(projectMember)
      .where(and(eq(projectMember.projectId, projectId), eq(projectMember.userId, userId)));

    if (actorId && displayName) {
      await writeActivity(tx, {
        type: "member_removed",
        target: { projectId },
        actorId,
        fromValue: displayName,
      });
    }
  });
}