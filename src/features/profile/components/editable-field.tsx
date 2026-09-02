"use client";

import type { KeyboardEvent } from "react";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { Button } from "react-aria-components/Button";
import { FieldError, Input, TextArea, TextField } from "react-aria-components/TextField";
import {
  CHANGES_NEED_A_CONNECTION,
  guardedWrite,
  useIsOffline,
} from "@/features/shell/components/connection-banner";
import { showToast } from "@/features/shell/components/toast-region";
import { updateOwnProfile } from "../actions";
import { PROFILE_FIELDS, type ProfileField } from "../fields";

const BOUND_BY_FIELD = Object.fromEntries(
  PROFILE_FIELDS.map((definition) => [definition.field, definition.bound]),
) as Record<ProfileField, number>;

function codePointLength(value: string): number {
  return [...value].length;
}

function refusalMessage(reason: string, label: string, bound: number): string {
  switch (reason) {
    case "required":
      return `${label} is required.`;
    case "too_long":
      return `${label} must be ${bound} characters or fewer.`;
    case "avatar_scheme":
      return "Enter a link starting with http:// or https://.";
    default:
      return "Something went wrong. Try again.";
  }
}

export function EditableField({
  field,
  label,
  value,
  placeholder,
  required = false,
  multiline = false,
}: {
  field: ProfileField;
  label: string;
  value: string | null;
  placeholder?: string;
  required?: boolean;
  multiline?: boolean;
}) {
  const bound = BOUND_BY_FIELD[field];
  const isOffline = useIsOffline();
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
    const current = optimisticValue ?? "";
    initialDraftRef.current = current;
    setDraft(current);
    setError(null);
    handledRef.current = false;
    setIsEditing(true);
  }

  function closeEdit() {
    setIsEditing(false);
    setError(null);
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
      setOptimisticValue(nextValue.trim().length === 0 ? null : nextValue.trim());
      const outcome = await guardedWrite(() => updateOwnProfile(field, nextValue));
      if (!outcome.performed) {
        showToast({ kind: "error", message: outcome.reason });
        return;
      }
      if (outcome.result.status === "refused") {
        showToast({ kind: "error", message: refusalMessage(outcome.result.reason, label, bound) });
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

    const trimmed = draft.trim();

    if (required && trimmed.length === 0) {
      setError(`${label} is required.`);
      handledRef.current = false;
      return;
    }

    if (trimmed.length > 0 && codePointLength(trimmed) > bound) {
      setError(`${label} must be ${bound} characters or fewer.`);
      handledRef.current = false;
      return;
    }

    if (isOffline) {
      setError(CHANGES_NEED_A_CONNECTION);
      showToast({ kind: "error", message: CHANGES_NEED_A_CONNECTION });
      handledRef.current = false;
      return;
    }

    const nextValue = draft;
    closeEdit();
    dispatchSave(nextValue);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
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
    return (
      <TextField
        aria-label={label}
        value={draft}
        onChange={setDraft}
        isInvalid={error !== null}
        className="flex flex-col gap-1">
        {multiline ? (
          <TextArea
            autoFocus
            rows={3}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            className="min-h-[4.5rem] w-full resize-none border border-(--color-divider) bg-(--color-surface) px-3 py-2 text-control text-(--color-text)"
          />
        ) : (
          <Input
            autoFocus
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            className="w-full border border-(--color-divider) bg-(--color-surface) px-3 py-2 text-control text-(--color-text)"
          />
        )}
        {error ? <FieldError className="text-label text-(--color-accent-700)">{error}</FieldError> : null}
      </TextField>
    );
  }

  const hasValue = optimisticValue !== null && optimisticValue.length > 0;

  return (
    <Button
      ref={buttonRef}
      onPress={openEdit}
      aria-label={label}
      className={`block w-full whitespace-pre-wrap text-start text-control ${multiline ? "min-h-[4.5rem]" : ""} ${
        hasValue ? "text-(--color-text)" : "text-(--color-text-placeholder)"
      }`}>
      {hasValue ? optimisticValue : (placeholder ?? "")}
    </Button>
  );
}