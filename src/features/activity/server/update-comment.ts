import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { comment } from "@/db/schema";
import { touched } from "@/db/touched";
import type { Actor } from "@/features/auth/server/actor";
import { dispatchNotificationMail } from "@/features/notifications/server/mail";
import { writeMentionDiffNotifications } from "@/features/notifications/server/write-notifications";
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

  let pendingMail: string[] = [];
  const result = await db.transaction(async (tx): Promise<UpdateCommentResult> => {
    const [current] = await tx
      .select({ body: comment.body, issueId: comment.issueId, projectId: comment.projectId })
      .from(comment)
      .where(eq(comment.id, input.commentId))
      .for("update");

    if (!current) {
      return { status: "not-found" };
    }

    await tx.update(comment).set(touched({ body })).where(eq(comment.id, input.commentId));

    const diff = {
      commentId: input.commentId,
      actorId: input.actor.id,
      previousBody: current.body,
      nextBody: body,
    };

    if (current.issueId !== null) {
      pendingMail = await writeMentionDiffNotifications(tx, {
        ...diff,
        target: { issueId: current.issueId },
      });
    } else if (current.projectId !== null) {
      pendingMail = await writeMentionDiffNotifications(tx, {
        ...diff,
        target: { projectId: current.projectId },
      });
    }

    return { status: "ok" };
  });

  dispatchNotificationMail(pendingMail);

  return result;
}