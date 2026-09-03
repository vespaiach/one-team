"use client";

import type { Key } from "react";
import { useState } from "react";
import { Button } from "react-aria-components/Button";
import { ComboBox, Input, Label, Popover } from "react-aria-components/ComboBox";
import { ListBox, ListBoxItem } from "react-aria-components/ListBox";
import { Tag, TagGroup, TagList } from "react-aria-components/TagGroup";
import type { RosterEntry } from "../server/queries";

export function MemberPickerField({
  candidates,
  selected,
  onChange,
}: {
  candidates: RosterEntry[];
  selected: RosterEntry[];
  onChange: (selected: RosterEntry[]) => void;
}) {
  const [inputValue, setInputValue] = useState("");
  const selectedIds = new Set(selected.map((entry) => entry.userId));
  const available = candidates.filter((candidate) => !selectedIds.has(candidate.userId));

  function handleSelectionChange(key: Key | null) {
    if (key === null) {
      return;
    }
    const chosen = candidates.find((candidate) => candidate.userId === key);
    if (!chosen) {
      return;
    }
    onChange([...selected, chosen]);
    setInputValue("");
  }

  function handleRemove(keys: Set<Key>) {
    onChange(selected.filter((entry) => !keys.has(entry.userId)));
  }

  return (
    <div className="flex flex-col gap-[8px]">
      <ComboBox
        items={available}
        inputValue={inputValue}
        onInputChange={setInputValue}
        selectedKey={null}
        onSelectionChange={handleSelectionChange}
        menuTrigger="focus"
        className="flex flex-col gap-[5px]">
        <Label>Members</Label>
        <Input placeholder="Add a member" />
        <Popover>
          <ListBox>
            {(item: RosterEntry) => <ListBoxItem id={item.userId}>{item.displayName}</ListBoxItem>}
          </ListBox>
        </Popover>
      </ComboBox>
      <TagGroup
        aria-label="Chosen members"
        onRemove={handleRemove}>
        <TagList
          items={selected}
          renderEmptyState={() => null}>
          {(item: RosterEntry) => (
            <Tag
              id={item.userId}
              textValue={item.displayName}>
              {item.displayName}
              <Button
                slot="remove"
                aria-label={`Remove ${item.displayName}`}>
                ×
              </Button>
            </Tag>
          )}
        </TagList>
      </TagGroup>
    </div>
  );
}