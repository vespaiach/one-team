import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { project } from "@/db/schema";
import { touched } from "@/db/touched";
import { writeActivity } from "@/features/activity/server/write-activity";

export async function setProjectStatus(
  projectId: string,
  status: "active" | "archived",
  actorId?: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(project).set(touched({ status })).where(eq(project.id, projectId));

    if (actorId) {
      await writeActivity(tx, {
        type: status === "archived" ? "archived" : "reopened",
        target: { projectId },
        actorId,
      });
    }
  });
}