"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { requireActor } from "@/features/auth/server/actor";
import { assertSameOrigin } from "@/features/auth/server/origin";
import { type CreateCommentResult, createComment as runCreateComment } from "./server/create-comment";
import type { ActivityTarget } from "./server/write-activity";

export type CreateCommentPayload = { target: unknown; body: unknown };
export type { CreateCommentResult };

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