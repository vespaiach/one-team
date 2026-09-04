"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { requireActor } from "@/features/auth/server/actor";
import { assertSameOrigin } from "@/features/auth/server/origin";
import { type CreateCommentResult, createComment as runCreateComment } from "./server/create-comment";
import { type DeleteCommentResult, deleteComment as runDeleteComment } from "./server/delete-comment";
import { setFeedFilter as runSetFeedFilter, type SetFeedFilterResult } from "./server/feed-filter";
import { type FeedCursor, type FeedPage, listFeed } from "./server/feed-queries";
import {
  type MentionCandidateGroups,
  listMentionCandidates as runListMentionCandidates,
} from "./server/mention-queries";
import { resolveMentions as runResolveMentions } from "./server/mention-resolve";
import { updateComment as runUpdateComment, type UpdateCommentResult } from "./server/update-comment";
import type { ActivityTarget } from "./server/write-activity";

export type CreateCommentPayload = { target: unknown; body: unknown };
export type UpdateCommentPayload = { commentId: unknown; body: unknown };
export type DeleteCommentPayload = { commentId: unknown };
export type SetFeedFilterPayload = { filter: unknown };
export type LoadFeedPagePayload = { target: unknown; cursor: unknown };
export type { CreateCommentResult, UpdateCommentResult, DeleteCommentResult, SetFeedFilterResult };

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

function parseFeedCursor(value: unknown): FeedCursor | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const { createdAt, id } = value as Record<string, unknown>;
  if (typeof createdAt !== "string" || typeof id !== "string") {
    return null;
  }
  const parsedCreatedAt = new Date(createdAt);
  if (Number.isNaN(parsedCreatedAt.getTime())) {
    return null;
  }
  return { createdAt: parsedCreatedAt, id };
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

export async function listMentionCandidates(target: unknown): Promise<MentionCandidateGroups> {
  assertSameOrigin({ headers: await headers() });
  await requireActor();

  const parsed = parseCommentTarget(target);
  if (parsed === null) {
    return { scoped: [], everyoneElse: [] };
  }

  return runListMentionCandidates(parsed);
}

export async function resolveCommentMentions(body: unknown): Promise<Record<string, string>> {
  assertSameOrigin({ headers: await headers() });
  await requireActor();

  if (typeof body !== "string") {
    return {};
  }

  const names = await runResolveMentions(body);
  return Object.fromEntries(names);
}

export async function setFeedFilter(input: SetFeedFilterPayload): Promise<SetFeedFilterResult> {
  assertSameOrigin({ headers: await headers() });
  const actor = await requireActor();

  return runSetFeedFilter({ actor, filter: input.filter });
}

export async function loadFeedPage(input: LoadFeedPagePayload): Promise<FeedPage> {
  assertSameOrigin({ headers: await headers() });
  const actor = await requireActor();

  const target = parseCommentTarget(input.target);
  const cursor = parseFeedCursor(input.cursor);
  if (target === null || cursor === null) {
    return { rows: [], hasNextPage: false };
  }

  return listFeed(target, { id: actor.id, isAdmin: actor.role === "admin" }, cursor);
}