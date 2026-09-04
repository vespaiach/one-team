import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { comment } from "@/db/schema";
import { touched } from "@/db/touched";
import type { Actor } from "@/features/auth/server/actor";
import { parseCommentBody } from "./input";

export type UpdateCommentField = "body";
export type UpdateCommentInvalidReason = "required" | "too-long";

export type UpdateCommentInput = {
  commentId: string;
  actor: Actor;
  body: unknown;
};

export type UpdateCommentResult =
  | { status: "ok" }
  | { status: "forbidden"; reason: string }
  | { status: "not-found" }
  | { status: "invalid"; field: UpdateCommentField; reason: UpdateCommentInvalidReason };

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

export async function updateComment(input: UpdateCommentInput): Promise<UpdateCommentResult> {
  const [row] = await db
    .select({ authorId: comment.authorId })
    .from(comment)
    .where(eq(comment.id, input.commentId));

  if (!row) {
    return { status: "not-found" };
  }

  if (row.authorId !== input.actor.id) {
    return { status: "forbidden", reason: "Only the comment's author can edit it." };
  }

  const body = parseCommentBody(input.body);
  if (body === null) {
    return {
      status: "invalid",
      field: "body",
      reason: isNonEmptyString(input.body) ? "too-long" : "required",
    };
  }

  await db.update(comment).set(touched({ body })).where(eq(comment.id, input.commentId));

  return { status: "ok" };
}