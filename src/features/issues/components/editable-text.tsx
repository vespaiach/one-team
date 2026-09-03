"use client";

import type { ClipboardEvent, KeyboardEvent, ReactNode } from "react";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { Button } from "react-aria-components/Button";
import { FieldError, Input, TextArea, TextField } from "react-aria-components/TextField";
import { showToast } from "@/features/shell/components/toast-region";
import type { UpdateIssuePayload, UpdateIssueResult } from "../actions";

function collapseLineBreaks(value: string): string {
  return value.replace(/\r\n|\r|\n/g, " ");
}

function describeRefusal(result: UpdateIssueResult, label: string): string {
  if (result.status === "forbidden") {
    return result.reason;
  }
  if (result.status === "invalid") {
    switch (result.reason) {
      case "required":
        return `${label} is required.`;
      case "too-long":
        return `${label} is too long.`;
      default:
        return `${label} isn't valid.`;
    }
  }
  return `Couldn't save ${label.toLowerCase()}. Try again.`;
}

export function EditableText({
  label,
  field,
  issueId,
  value,
  multiline = false,
  maxLength,
  renderValue,
  updateIssueAction,
}: {
  label: string;
  field: "title" | "description";
  issueId: string;
  value: string;
  multiline?: boolean;
  maxLength: number;
  renderValue?: (value: string) => ReactNode;
  updateIssueAction: (input: UpdateIssuePayload) => Promise<UpdateIssueResult>;
}) {
  const [optimisticValue, setOptimisticValue] = useOptimistic(value);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
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
    initialDraftRef.current = optimisticValue;
    setDraft(optimisticValue);
    setError(null);
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
    setError(null);
    closeEdit();
  }

  function handleChange(next: string) {
    setDraft(multiline ? next : collapseLineBreaks(next));
  }

  function dispatchSave(nextValue: string) {
    startTransition(async () => {
      setOptimisticValue(nextValue);
      const input: UpdateIssuePayload =
        field === "title" ? { issueId, title: nextValue } : { issueId, description: nextValue };
      const result = await updateIssueAction(input);
      if (result.status !== "ok") {
        showToast({ kind: "error", message: describeRefusal(result, label) });
      }
    });
  }

  function save() {
    if (handledRef.current) {
      return;
    }

    const candidate = multiline ? draft : draft.trim();
    if (!multiline && candidate === "") {
      setError(`${label} is required.`);
      return;
    }
    if (candidate.length > maxLength) {
      setError(`${label} must be ${maxLength.toLocaleString()} characters or fewer.`);
      return;
    }

    handledRef.current = true;
    setError(null);

    if (candidate === initialDraftRef.current) {
      closeEdit();
      return;
    }

    closeEdit();
    dispatchSave(candidate);
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

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text");
    if (!/\r\n|\r|\n/.test(pasted)) {
      return;
    }
    event.preventDefault();
    const target = event.currentTarget;
    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? target.value.length;
    const nextValue = target.value.slice(0, start) + collapseLineBreaks(pasted) + target.value.slice(end);
    setDraft(nextValue);
  }

  if (isEditing) {
    return (
      <TextField
        aria-label={label}
        value={draft}
        onChange={handleChange}
        isInvalid={error !== null}
        className="flex flex-col gap-1">
        {multiline ? (
          <TextArea
            autoFocus
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            className="max-h-[calc(100vh-320px)] min-h-[4.5rem] w-full resize-none overflow-y-auto border border-(--color-divider) bg-(--color-surface) px-3 py-2 text-control text-(--color-text)"
          />
        ) : (
          <Input
            autoFocus
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            onPaste={handlePaste}
            className="w-full border border-(--color-divider) bg-(--color-surface) px-3 py-2 text-control text-(--color-text)"
          />
        )}
        {error && <FieldError>{error}</FieldError>}
      </TextField>
    );
  }

  return (
    <Button
      ref={buttonRef}
      onPress={openEdit}
      aria-label={label}
      className="block w-full whitespace-pre-wrap text-start text-control text-(--color-text)">
      {renderValue ? renderValue(optimisticValue) : optimisticValue}
    </Button>
  );
}