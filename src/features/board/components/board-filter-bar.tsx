"use client";

import Link from "next/link";
import { Button } from "react-aria-components/Button";
import type { Grouping } from "../lane-model";
import { GroupingControl } from "./grouping-control";

export function BoardFilterBar({
  mineOnly,
  onToggleMine,
  viewerName,
  grouping,
  onGroupingChange,
  isAdmin,
  projectKey,
}: {
  mineOnly: boolean;
  onToggleMine: () => void;
  viewerName: string;
  grouping: Grouping;
  onGroupingChange: (grouping: Grouping) => void;
  isAdmin: boolean;
  projectKey: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-(--color-divider) border-b px-4 py-1.5">
      {mineOnly ? (
        <span className="flex h-6 items-stretch overflow-hidden border border-(--color-divider) text-label">
          <span className="flex items-center bg-(--color-chrome-tint-strong) px-1.5 text-(--color-text-muted)">
            Assignee
          </span>
          <span className="flex items-center px-1.5 text-(--color-text-muted)">is</span>
          <span className="flex items-center gap-1 px-1.5">{viewerName}</span>
          <Button
            onPress={onToggleMine}
            aria-label="Remove assignee filter"
            className="flex items-center border-(--color-divider) border-l px-1.5 text-(--color-text-muted) data-[hovered]:bg-(--color-danger-fill) data-[hovered]:text-(--color-danger-text)">
            ✕
          </Button>
        </span>
      ) : (
        <Button
          onPress={onToggleMine}
          className="flex h-6 items-center gap-1.5 border border-(--color-divider) border-dashed px-2 text-(--color-text-muted) text-label data-[hovered]:border-(--color-accent) data-[hovered]:text-(--color-accent)">
          + Filter
        </Button>
      )}
      <div className="ml-auto flex items-center gap-3">
        <span className="hidden font-mono text-(--color-text-muted) text-caption sm:inline">
          Drag a card to move it
        </span>
        <GroupingControl
          grouping={grouping}
          onChange={onGroupingChange}
        />
        {isAdmin ? (
          <Link
            href={`/projects/${projectKey}/details`}
            className="text-(--color-text-muted) text-label no-underline hover:text-(--color-text)">
            Edit columns
          </Link>
        ) : null}
      </div>
    </div>
  );
}