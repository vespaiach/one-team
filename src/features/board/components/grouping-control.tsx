"use client";

import { Button } from "react-aria-components/Button";
import { Label } from "react-aria-components/Label";
import { ListBox, ListBoxItem } from "react-aria-components/ListBox";
import { Popover } from "react-aria-components/Popover";
import { Select, SelectValue } from "react-aria-components/Select";
import type { Grouping } from "../lane-model";

const GROUPINGS: { id: Grouping; name: string }[] = [
  { id: "column", name: "Column" },
  { id: "assignee", name: "Assignee" },
  { id: "priority", name: "Priority" },
];

export function GroupingControl({
  grouping = "column",
  onChange,
}: {
  grouping?: Grouping;
  onChange: (grouping: Grouping) => void;
}) {
  const current = GROUPINGS.find((candidate) => candidate.id === grouping) ?? GROUPINGS[0];

  return (
    <Select
      selectedKey={grouping}
      onSelectionChange={(key) => {
        const chosen = GROUPINGS.find((candidate) => candidate.id === key);
        if (chosen) {
          onChange(chosen.id);
        }
      }}>
      <Label className="sr-only">Group by</Label>
      <Button className="flex h-[26px] items-center gap-1 px-2 font-medium text-(--color-text-muted) text-label data-[hovered]:bg-(--color-chrome-tint-strong) data-[hovered]:text-(--color-text) data-[focus-visible]:outline-2 data-[focus-visible]:outline-(--color-accent)">
        Group: <SelectValue>{current?.name}</SelectValue>
      </Button>
      <Popover className="min-w-[140px] border border-(--color-divider) bg-(--color-bg) py-1 shadow-md">
        <ListBox className="flex flex-col">
          {GROUPINGS.map((candidate) => (
            <ListBoxItem
              key={candidate.id}
              id={candidate.id}
              textValue={candidate.name}
              className="cursor-default px-3 py-1.5 text-control text-(--color-text) data-[focus-visible]:outline-2 data-[focus-visible]:outline-(--color-accent) data-[hovered]:bg-(--color-chrome-tint-strong) data-[selected]:bg-(--color-accent-100) data-[selected]:text-(--color-accent-800)">
              {candidate.name}
            </ListBoxItem>
          ))}
        </ListBox>
      </Popover>
    </Select>
  );
}