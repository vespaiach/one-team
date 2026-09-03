import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { project } from "@/db/schema";
import { touched } from "@/db/touched";

export async function setProjectStatus(projectId: string, status: "active" | "archived"): Promise<void> {
  await db.update(project).set(touched({ status })).where(eq(project.id, projectId));
}