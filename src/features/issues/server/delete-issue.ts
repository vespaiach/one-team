import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { issue } from "@/db/schema";
import type { Actor } from "@/features/auth/server/actor";
import { isAdmin } from "@/features/projects/server/authorization";

export type DeleteIssueInput = {
  issueId: string;
  actor: Actor;
};

export type DeleteIssueResult =
  | { status: "ok" }
  | { status: "forbidden"; reason: string }
  | { status: "not-found" };

export async function deleteIssue(input: DeleteIssueInput): Promise<DeleteIssueResult> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ id: issue.id })
      .from(issue)
      .where(eq(issue.id, input.issueId))
      .for("update");
    if (!row) {
      return { status: "not-found" };
    }

    if (!isAdmin(input.actor)) {
      return { status: "forbidden", reason: "Only admins can delete issues." };
    }

    await tx.delete(issue).where(eq(issue.id, input.issueId));
    return { status: "ok" };
  });
}