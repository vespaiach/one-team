"use client";

import { Markdown } from "@/components/shared/markdown/markdown";
import { EditableField, type EditableFieldSaveResult } from "./editable-field";

export function DescriptionView({
  description,
  isDisabled,
  disabledReason,
  onSave,
}: {
  description: string | null;
  isDisabled?: boolean;
  disabledReason?: string;
  onSave: (nextValue: string) => Promise<EditableFieldSaveResult>;
}) {
  return (
    <EditableField
      label="Description"
      value={description}
      placeholder="Add a description"
      multiline
      isDisabled={isDisabled}
      disabledReason={disabledReason}
      renderValue={(value) => <Markdown source={value} />}
      onSave={onSave}
    />
  );
}