"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { Button, Disclosure, DisclosurePanel } from "react-aria-components/Disclosure";
import { showToast } from "@/features/shell/components/toast-region";
import { type CreateCommentResult, createComment, loadFeedPage } from "../actions";
import type { FeedPage, FeedRow as FeedRowData } from "../server/feed-queries";
import { collapseFeed } from "./collapse";
import { Composer } from "./composer";
import { FeedFilterToggle, type FeedFilterValue, filterFeedRows } from "./feed-filter-toggle";
import { FeedRow } from "./feed-row";

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

function buildOptimisticRow(tempId: string, body: string, viewer: Viewer): FeedRowData {
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

function CollapsedActivityGroup({ rows }: { rows: FeedRowData[] }) {
  const [firstRow] = rows;
  if (!firstRow) {
    return null;
  }
  const actorName = `${firstRow.actor.firstName} ${firstRow.actor.lastName}`;

  return (
    <Disclosure>
      <Button
        slot="trigger"
        className="text-control text-(--color-text)">
        {actorName} made {rows.length} changes
      </Button>
      <DisclosurePanel>
        <ul className="flex flex-col gap-2 pl-4">
          {rows.map((row) => (
            <li key={row.id}>
              <FeedRow row={row} />
            </li>
          ))}
        </ul>
      </DisclosurePanel>
    </Disclosure>
  );
}

export function Feed({
  target,
  initialPage,
  canPost,
  postReason,
  viewer,
  feedFilter,
}: {
  target: FeedTarget;
  initialPage: FeedPage;
  canPost: boolean;
  postReason: string | null;
  viewer: Viewer;
  feedFilter: FeedFilterValue;
}) {
  const [appendedRows, setAppendedRows] = useState<FeedRowData[]>([]);
  const [hasNextPage, setHasNextPage] = useState(initialPage.hasNextPage);
  const [filter, setFilter] = useState<FeedFilterValue>(feedFilter);
  const [, startTransition] = useTransition();
  const [, startLoadMoreTransition] = useTransition();
  const sentinelRef = useRef<HTMLLIElement | null>(null);
  const isLoadingMoreRef = useRef(false);

  const baseRows = [...initialPage.rows, ...appendedRows];
  const [rows, addOptimisticRow] = useOptimistic(baseRows, (state: FeedRowData[], row: FeedRowData) => [
    row,
    ...state,
  ]);

  useEffect(() => {
    const node = sentinelRef.current;
    const foot = rows.at(-1);
    if (!node || !hasNextPage || !foot) {
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (isLoadingMoreRef.current || !entries.some((entry) => entry.isIntersecting)) {
        return;
      }
      isLoadingMoreRef.current = true;
      startLoadMoreTransition(async () => {
        const nextPage = await loadFeedPage({
          target,
          cursor: { createdAt: foot.createdAt.toISOString(), id: foot.id },
        });
        setAppendedRows((previous) => [...previous, ...nextPage.rows]);
        setHasNextPage(nextPage.hasNextPage);
        isLoadingMoreRef.current = false;
      });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, rows, target]);

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

  const visibleRows = filterFeedRows(rows, filter);
  const groups = collapseFeed(visibleRows);

  return (
    <div className="flex flex-col gap-4">
      <Composer
        target={target}
        canPost={canPost}
        postReason={postReason}
        onSubmit={handleSubmit}
      />
      <FeedFilterToggle
        value={filter}
        onChange={setFilter}
      />
      <ul className="flex flex-col gap-4">
        {groups.map((group) => {
          const [firstRow] = group;
          if (!firstRow) {
            return null;
          }
          return (
            <li key={firstRow.id}>
              {group.length > 1 ? <CollapsedActivityGroup rows={group} /> : <FeedRow row={firstRow} />}
            </li>
          );
        })}
        {hasNextPage ? (
          <li
            ref={sentinelRef}
            data-testid="feed-load-more-sentinel"
            aria-hidden="true"
          />
        ) : null}
      </ul>
    </div>
  );
}