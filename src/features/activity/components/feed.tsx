"use client";

import { useOptimistic, useTransition } from "react";
import { showToast } from "@/features/shell/components/toast-region";
import { type CreateCommentResult, createComment } from "../actions";
import type { FeedPage, FeedRow } from "../server/feed-queries";
import { CommentRow } from "./comment-row";
import { Composer } from "./composer";

type FeedTarget = { issueId: string } | { projectId: string };

type Viewer = { id: string; firstName: string; lastName: string; avatarUrl: string | null };

function describeCreateCommentRefusal(result: Exclude<CreateCommentResult, { status: "ok" }>): string {
  if (result.status === "forbidden") {
    return result.reason;
  }
  if (result.status === "invalid") {
    return result.reason === "too-long"
      ? "Comment must be 10,000 characters or fewer."
      : "A comment can't be empty.";
  }
  return "Couldn't post your comment. Try again.";
}

function buildOptimisticRow(tempId: string, body: string, viewer: Viewer): FeedRow {
  return {
    id: tempId,
    kind: "comment",
    actorId: viewer.id,
    actor: {
      id: viewer.id,
      firstName: viewer.firstName,
      lastName: viewer.lastName,
      avatarUrl: viewer.avatarUrl,
      role: "member",
      jobTitle: null,
      deactivatedAt: null,
    },
    createdAt: new Date(),
    body,
    canEdit: true,
    canDelete: true,
    field: null,
    fromValue: null,
    toValue: null,
  };
}

export function Feed({
  target,
  initialPage,
  canPost,
  postReason,
  viewer,
}: {
  target: FeedTarget;
  initialPage: FeedPage;
  canPost: boolean;
  postReason: string | null;
  viewer: Viewer;
}) {
  const [rows, addOptimisticRow] = useOptimistic(initialPage.rows, (state: FeedRow[], row: FeedRow) => [
    row,
    ...state,
  ]);
  const [, startTransition] = useTransition();

  function handleSubmit(body: string) {
    const tempId = `optimistic-${crypto.randomUUID()}`;
    startTransition(async () => {
      addOptimisticRow(buildOptimisticRow(tempId, body, viewer));
      const result = await createComment({ target, body });
      if (result.status !== "ok") {
        showToast({ kind: "error", message: describeCreateCommentRefusal(result) });
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Composer
        canPost={canPost}
        postReason={postReason}
        onSubmit={handleSubmit}
      />
      <ul className="flex flex-col gap-4">
        {rows.map((row) => (
          <li key={row.id}>
            <CommentRow
              id={row.id}
              actor={row.actor}
              body={row.body ?? ""}
              createdAt={row.createdAt}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}