import type { FeedRow as FeedRowData } from "../server/feed-queries";
import { ActivityRow } from "./activity-row";
import { CommentRow } from "./comment-row";

export function FeedRow({ row }: { row: FeedRowData }) {
  if (row.kind === "comment") {
    return (
      <CommentRow
        id={row.id}
        actor={row.actor}
        body={row.body ?? ""}
        createdAt={row.createdAt}
        canEdit={row.canEdit ?? false}
        canDelete={row.canDelete ?? false}
      />
    );
  }

  return (
    <ActivityRow
      actor={row.actor}
      type={row.kind}
      field={row.field}
      fromValue={row.fromValue}
      toValue={row.toValue}
    />
  );
}