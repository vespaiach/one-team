"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { Button } from "react-aria-components/Button";
import { Input, TextArea, TextField } from "react-aria-components/TextField";
import { showToast } from "@/features/shell/components/toast-region";

export type EditableFieldSaveResult =
  | { status: "saved" }
  | { status: "invalid"; reason: string }
  | { status: "forbidden" };

export type EditableFieldEditorProps = {
  value: string;
  onChange: (next: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  onBlur: () => void;
};

function defaultErrorMessage(reason: string, label: string): string {
  switch (reason) {
    case "required":
      return `${label} is required.`;
    case "too_long":
      return `${label} is too long.`;
    case "before_start":
      return `${label} can't be before the start date.`;
    default:
      return "Something went wrong. Try again.";
  }
}

function DefaultEditor({
  label,
  multiline,
  value,
  onChange,
  onKeyDown,
  onBlur,
}: EditableFieldEditorProps & { label: string; multiline: boolean }) {
  return (
    <TextField
      aria-label={label}
      value={value}
      onChange={onChange}
      className="flex flex-col gap-1">
      {multiline ? (
        <TextArea
          autoFocus
          onKeyDown={onKeyDown}
          onBlur={onBlur}
          className="min-h-[4.5rem] w-full resize-none border border-(--color-divider) bg-(--color-surface) px-3 py-2 text-control text-(--color-text)"
        />
      ) : (
        <Input
          autoFocus
          onKeyDown={onKeyDown}
          onBlur={onBlur}
          className="w-full border border-(--color-divider) bg-(--color-surface) px-3 py-2 text-control text-(--color-text)"
        />
      )}
    </TextField>
  );
}

export function EditableField({
  label,
  value,
  placeholder,
  multiline = false,
  isDisabled = false,
  disabledReason,
  renderValue,
  renderEditor,
  onSave,
}: {
  label: string;
  value: string | null;
  placeholder?: string;
  multiline?: boolean;
  isDisabled?: boolean;
  disabledReason?: string;
  renderValue?: (value: string) => ReactNode;
  renderEditor?: (props: EditableFieldEditorProps) => ReactNode;
  onSave: (nextValue: string) => Promise<EditableFieldSaveResult>;
}) {
  const [optimisticValue, setOptimisticValue] = useOptimistic(value);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [, startTransition] = useTransition();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const wasEditingRef = useRef(false);
  const handledRef = useRef(false);
  const initialDraftRef = useRef("");

  useEffect(() => {
    if (wasEditingRef.current && !isEditing) {
      buttonRef.current?.focus();
    }
    wasEditingRef.current = isEditing;
  }, [isEditing]);

  function openEdit() {
    const current = optimisticValue ?? "";
    initialDraftRef.current = current;
    setDraft(current);
    handledRef.current = false;
    setIsEditing(true);
  }

  function closeEdit() {
    setIsEditing(false);
  }

  function cancelEdit() {
    if (handledRef.current) {
      return;
    }
    handledRef.current = true;
    closeEdit();
  }

  function dispatchSave(nextValue: string) {
    startTransition(async () => {
      setOptimisticValue(nextValue);
      const result = await onSave(nextValue);
      if (result.status !== "saved") {
        const reason = result.status === "invalid" ? result.reason : result.status;
        showToast({ kind: "error", message: defaultErrorMessage(reason, label) });
      }
    });
  }

  function save() {
    if (handledRef.current) {
      return;
    }
    handledRef.current = true;

    if (draft === initialDraftRef.current) {
      closeEdit();
      return;
    }

    const nextValue = draft;
    closeEdit();
    dispatchSave(nextValue);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      cancelEdit();
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      save();
      return;
    }
    if (event.key === "Enter" && !multiline) {
      event.preventDefault();
    }
  }

  function handleBlur() {
    save();
  }

  if (isEditing) {
    const editorProps: EditableFieldEditorProps = {
      value: draft,
      onChange: setDraft,
      onKeyDown: handleKeyDown,
      onBlur: handleBlur,
    };

    return renderEditor ? (
      renderEditor(editorProps)
    ) : (
      <DefaultEditor
        label={label}
        multiline={multiline}
        {...editorProps}
      />
    );
  }

  const hasValue = optimisticValue !== null && optimisticValue.length > 0;
  const reasonId = disabledReason ? `${label}-disabled-reason` : undefined;

  return (
    <>
      <Button
        ref={buttonRef}
        onPress={openEdit}
        isDisabled={isDisabled}
        aria-label={label}
        aria-describedby={reasonId}
        className={`block w-full whitespace-pre-wrap text-start text-control ${multiline ? "min-h-[4.5rem]" : ""} ${
          hasValue ? "text-(--color-text)" : "text-(--color-text-placeholder)"
        }`}>
        {hasValue ? (renderValue?.(optimisticValue) ?? optimisticValue) : (placeholder ?? "")}
      </Button>
      {isDisabled && disabledReason ? (
        <p
          id={reasonId}
          className="text-label text-(--color-text-muted)">
          {disabledReason}
        </p>
      ) : null}
    </>
  );
}