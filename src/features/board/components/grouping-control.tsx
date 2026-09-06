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
  return (
    <Select
      selectedKey={grouping}
      onSelectionChange={(key) => {
        const chosen = GROUPINGS.find((candidate) => candidate.id === key);
        if (chosen) {
          onChange(chosen.id);
        }
      }}
      className="flex items-center gap-2">
      <Label className="text-label text-(--color-text-muted)">Group by</Label>
      <Button className="border border-(--color-divider) px-2 py-1 text-control text-(--color-text) data-[hovered]:bg-(--color-surface-hover) data-[pressed]:bg-(--color-surface) data-[focus-visible]:outline-2 data-[focus-visible]:outline-(--color-accent)">
        <SelectValue />
      </Button>
      <Popover className="min-w-[140px] border border-(--color-divider) bg-(--color-surface) py-1">
        <ListBox className="flex flex-col">
          {GROUPINGS.map((candidate) => (
            <ListBoxItem
              key={candidate.id}
              id={candidate.id}
              textValue={candidate.name}
              className="cursor-default px-3 py-1.5 text-control text-(--color-text) data-[hovered]:bg-(--color-surface-hover) data-[selected]:font-semibold data-[selected]:underline data-[focus-visible]:outline-2 data-[focus-visible]:outline-(--color-accent)">
              {candidate.name}
            </ListBoxItem>
          ))}
        </ListBox>
      </Popover>
    </Select>
  );
}