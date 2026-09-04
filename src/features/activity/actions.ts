"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { requireActor } from "@/features/auth/server/actor";
import { assertSameOrigin } from "@/features/auth/server/origin";
import { type CreateCommentResult, createComment as runCreateComment } from "./server/create-comment";
import { type DeleteCommentResult, deleteComment as runDeleteComment } from "./server/delete-comment";
import { updateComment as runUpdateComment, type UpdateCommentResult } from "./server/update-comment";
import type { ActivityTarget } from "./server/write-activity";

export type CreateCommentPayload = { target: unknown; body: unknown };
export type UpdateCommentPayload = { commentId: unknown; body: unknown };
export type DeleteCommentPayload = { commentId: unknown };
export type { CreateCommentResult, UpdateCommentResult, DeleteCommentResult };

function parseCommentTarget(value: unknown): ActivityTarget | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  if ("issueId" in value && typeof value.issueId === "string") {
    return { issueId: value.issueId };
  }
  if ("projectId" in value && typeof value.projectId === "string") {
    return { projectId: value.projectId };
  }
  return null;
}

export async function createComment(input: CreateCommentPayload): Promise<CreateCommentResult> {
  assertSameOrigin({ headers: await headers() });
  const actor = await requireActor();

  const target = parseCommentTarget(input.target);
  if (target === null) {
    return { status: "not-found" };
  }

  const result = await runCreateComment({ target, actor, body: input.body });

  if (result.status === "ok") {
    refresh();
  }

  return result;
}

export async function updateComment(input: UpdateCommentPayload): Promise<UpdateCommentResult> {
  assertSameOrigin({ headers: await headers() });
  const actor = await requireActor();

  if (typeof input.commentId !== "string") {
    return { status: "not-found" };
  }

  const result = await runUpdateComment({ commentId: input.commentId, actor, body: input.body });

  if (result.status === "ok") {
    refresh();
  }

  return result;
}

export async function deleteComment(input: DeleteCommentPayload): Promise<DeleteCommentResult> {
  assertSameOrigin({ headers: await headers() });
  const actor = await requireActor();

  if (typeof input.commentId !== "string") {
    return { status: "not-found" };
  }

  const result = await runDeleteComment({ commentId: input.commentId, actor });

  if (result.status === "ok") {
    refresh();
  }

  return result;
}