"use client";

import Link from "next/link";
import { useId } from "react";
import type { Key, Selection } from "react-aria-components";
import { ListBox, ListBoxItem } from "react-aria-components/ListBox";
import type { LabelOption } from "../server/queries";

export function LabelPickerField({
  options,
  onToggle,
  canManageLabels,
  isDisabled = false,
  disabledReason = "",
}: {
  options: LabelOption[];
  onToggle: (labelId: string, applied: boolean) => void;
  canManageLabels: boolean;
  isDisabled?: boolean;
  disabledReason?: string;
}) {
  const labelId = useId();
  const reasonId = useId();
  const selectedKeys: Set<Key> = new Set(
    options.filter((option) => option.applied).map((option) => option.id),
  );
  const disabledKeys: Set<Key> = isDisabled ? new Set(options.map((option) => option.id)) : new Set();

  function handleSelectionChange(keys: Selection) {
    const nextSelected = keys === "all" ? new Set(options.map((option) => option.id)) : keys;
    for (const option of options) {
      const nextApplied = nextSelected.has(option.id);
      if (nextApplied !== option.applied) {
        onToggle(option.id, nextApplied);
      }
    }
  }

  return (
    <div className="flex flex-col gap-[5px]">
      <span
        id={labelId}
        className="text-label text-(--color-text-muted)">
        Labels
      </span>
      <ListBox
        aria-labelledby={labelId}
        aria-describedby={isDisabled && disabledReason ? reasonId : undefined}
        selectionMode="multiple"
        selectionBehavior="toggle"
        selectedKeys={selectedKeys}
        onSelectionChange={handleSelectionChange}
        disabledKeys={disabledKeys}
        className="flex flex-col gap-1 border border-(--color-divider) bg-(--color-surface) p-1">
        {options.map((option) => (
          <ListBoxItem
            key={option.id}
            id={option.id}
            textValue={option.name}
            className="px-2 py-1 text-control text-(--color-text)">
            {option.name}
          </ListBoxItem>
        ))}
      </ListBox>
      {isDisabled && disabledReason ? (
        <p
          id={reasonId}
          className="text-label text-(--color-text-muted)">
          {disabledReason}
        </p>
      ) : null}
      {canManageLabels ? (
        <Link
          href="/settings/labels"
          className="text-label text-(--color-text-muted) underline">
          Manage labels
        </Link>
      ) : null}
    </div>
  );
}