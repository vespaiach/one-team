"use client";

import { useTransition } from "react";
import { Radio, RadioGroup } from "react-aria-components/RadioGroup";
import { setFeedFilter } from "../actions";
import type { FeedRow } from "../server/feed-queries";

export type FeedFilterValue = "comments" | "all";

function isFeedFilterValue(value: string): value is FeedFilterValue {
  return value === "comments" || value === "all";
}

export function filterFeedRows(rows: FeedRow[], filter: FeedFilterValue): FeedRow[] {
  return filter === "comments" ? rows.filter((row) => row.kind === "comment") : rows;
}

export function FeedFilterToggle({
  value,
  onChange,
}: {
  value: FeedFilterValue;
  onChange: (value: FeedFilterValue) => void;
}) {
  const [, startTransition] = useTransition();

  function handleChange(next: string) {
    if (!isFeedFilterValue(next)) {
      return;
    }
    onChange(next);
    startTransition(async () => {
      await setFeedFilter({ filter: next });
    });
  }

  return (
    <RadioGroup
      aria-label="Feed filter"
      orientation="horizontal"
      value={value}
      onChange={handleChange}
      className="flex gap-4">
      <Radio value="comments">Comments only</Radio>
      <Radio value="all">All activity</Radio>
    </RadioGroup>
  );
}