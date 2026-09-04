import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { comment } from "@/db/schema";
import type { Actor } from "@/features/auth/server/actor";
import { isAdmin } from "@/features/projects/server/authorization";

export type DeleteCommentInput = {
  commentId: string;
  actor: Actor;
};

export type DeleteCommentResult =
  | { status: "ok" }
  | { status: "forbidden"; reason: string }
  | { status: "not-found" };

export async function deleteComment(input: DeleteCommentInput): Promise<DeleteCommentResult> {
  const [row] = await db
    .select({ authorId: comment.authorId })
    .from(comment)
    .where(eq(comment.id, input.commentId));

  if (!row) {
    return { status: "not-found" };
  }

  if (row.authorId !== input.actor.id && !isAdmin(input.actor)) {
    return { status: "forbidden", reason: "Only the comment's author or an admin can delete it." };
  }

  const deletedRows = await db
    .delete(comment)
    .where(eq(comment.id, input.commentId))
    .returning({ id: comment.id });

  if (deletedRows.length === 0) {
    return { status: "not-found" };
  }

  return { status: "ok" };
}