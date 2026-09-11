"use client";

import type { Key } from "react";
import { useState } from "react";
import { Button } from "react-aria-components/Button";
import { ComboBox, Popover as ComboBoxPopover, Input, Label } from "react-aria-components/ComboBox";
import { Dialog, DialogTrigger } from "react-aria-components/Dialog";
import { ListBox, ListBoxItem } from "react-aria-components/ListBox";
import { Popover } from "react-aria-components/Popover";
import { Tag, TagGroup, TagList } from "react-aria-components/TagGroup";
import { AvatarStack } from "@/components/ui/avatar-stack";
import type { RosterEntry } from "../server/queries";
import { ChevronDownIcon, MembersIcon } from "./icons";

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
    <DialogTrigger>
      <Button
        aria-label="Members"
        className="flex h-7 items-center gap-1.5 border border-(--color-divider) px-2.5 text-control text-(--color-text-muted) data-[hovered]:border-(--color-accent) data-[hovered]:text-(--color-text) data-[focus-visible]:outline-2 data-[focus-visible]:outline-(--color-accent)">
        <MembersIcon size={14} />
        {selected.length > 0 ? (
          <AvatarStack
            people={selected.map((entry) => ({
              id: entry.userId,
              name: entry.displayName,
              avatarUrl: entry.avatarUrl,
            }))}
            limit={3}
          />
        ) : (
          "Members"
        )}
        <ChevronDownIcon size={14} />
      </Button>
      <Popover className="border border-(--color-divider) bg-(--color-bg) p-3 shadow-md">
        <Dialog className="flex w-[260px] flex-col gap-2 outline-none">
          <ComboBox
            items={available}
            inputValue={inputValue}
            onInputChange={setInputValue}
            selectedKey={null}
            onSelectionChange={handleSelectionChange}
            menuTrigger="focus"
            className="flex flex-col gap-1">
            <Label className="sr-only">Members</Label>
            <Input
              placeholder="Add a member"
              className="border border-(--color-divider) bg-(--color-surface) px-2 py-1 text-control text-(--color-text)"
            />
            <ComboBoxPopover>
              <ListBox>
                {(item: RosterEntry) => <ListBoxItem id={item.userId}>{item.displayName}</ListBoxItem>}
              </ListBox>
            </ComboBoxPopover>
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
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}