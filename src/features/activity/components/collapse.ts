import type { FeedRow } from "../server/feed-queries";

const COLLAPSE_WINDOW_MS = 5 * 60 * 1000;

function extendsRun(previous: FeedRow, next: FeedRow): boolean {
  return (
    previous.kind !== "comment" &&
    next.kind !== "comment" &&
    previous.actorId === next.actorId &&
    Math.abs(next.createdAt.getTime() - previous.createdAt.getTime()) <= COLLAPSE_WINDOW_MS
  );
}

export function collapseFeed(rows: FeedRow[]): FeedRow[][] {
  const groups: FeedRow[][] = [];

  for (const row of rows) {
    const currentGroup = groups.at(-1);
    const previousRow = currentGroup?.at(-1);

    if (currentGroup && previousRow && extendsRun(previousRow, row)) {
      currentGroup.push(row);
    } else {
      groups.push([row]);
    }
  }

  return groups;
}