"use client";

import type { FocusEvent, KeyboardEvent } from "react";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { Button } from "react-aria-components/Button";
import { FieldError, TextArea, TextField } from "react-aria-components/TextField";
import { showToast } from "@/features/shell/components/toast-region";
import { deleteComment, type UpdateCommentResult, updateComment } from "../actions";

const MAX_COMMENT_BODY_LENGTH = 10000;

const RELATIVE_TIME_FORMAT = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });

const RELATIVE_TIME_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 60 * 60],
  ["month", 30 * 24 * 60 * 60],
  ["day", 24 * 60 * 60],
  ["hour", 60 * 60],
  ["minute", 60],
];

function formatRelativeTime(createdAt: Date, now: Date): string {
  const seconds = Math.round((createdAt.getTime() - now.getTime()) / 1000);
  for (const [unit, unitSeconds] of RELATIVE_TIME_UNITS) {
    if (Math.abs(seconds) >= unitSeconds) {
      return RELATIVE_TIME_FORMAT.format(Math.round(seconds / unitSeconds), unit);
    }
  }
  return RELATIVE_TIME_FORMAT.format(0, "minute");
}

function describeUpdateRefusal(result: Exclude<UpdateCommentResult, { status: "ok" }>): string {
  if (result.status === "forbidden") {
    return result.reason;
  }
  if (result.status === "invalid") {
    return result.reason === "too-long"
      ? "Comment must be 10,000 characters or fewer."
      : "A comment can't be empty.";
  }
  return "Couldn't save your edit. Try again.";
}

export function CommentRow({
  id,
  actor,
  body,
  createdAt,
  canEdit,
  canDelete,
}: {
  id: string;
  actor: { firstName: string; lastName: string; avatarUrl: string | null };
  body: string;
  createdAt: Date;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const displayName = `${actor.firstName} ${actor.lastName}`;

  const [optimisticBody, setOptimisticBody] = useOptimistic(body);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [, startTransition] = useTransition();

  const editButtonRef = useRef<HTMLButtonElement>(null);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const wasEditingRef = useRef(false);
  const handledRef = useRef(false);
  const initialDraftRef = useRef("");

  useEffect(() => {
    if (wasEditingRef.current && !isEditing) {
      editButtonRef.current?.focus();
    }
    wasEditingRef.current = isEditing;
  }, [isEditing]);

  function openEdit() {
    initialDraftRef.current = optimisticBody;
    setDraft(optimisticBody);
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

  function dispatchSave(nextBody: string) {
    startTransition(async () => {
      setOptimisticBody(nextBody);
      const result = await updateComment({ commentId: id, body: nextBody });
      if (result.status !== "ok") {
        showToast({ kind: "error", message: describeUpdateRefusal(result) });
      }
    });
  }

  function save() {
    if (handledRef.current) {
      return;
    }

    if (draft === initialDraftRef.current) {
      handledRef.current = true;
      closeEdit();
      return;
    }

    const trimmed = draft.trim();
    if (trimmed === "") {
      setError("A comment can't be empty.");
      return;
    }
    if (trimmed.length > MAX_COMMENT_BODY_LENGTH) {
      setError(`Comments must be ${MAX_COMMENT_BODY_LENGTH.toLocaleString()} characters or fewer.`);
      return;
    }

    handledRef.current = true;
    closeEdit();
    dispatchSave(trimmed);
  }

  function handleEditKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      cancelEdit();
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      save();
    }
  }

  function openDeleteConfirm() {
    setIsConfirmingDelete(true);
  }

  function cancelDelete() {
    setIsConfirmingDelete(false);
    deleteButtonRef.current?.focus();
  }

  function confirmDelete() {
    setIsConfirmingDelete(false);
    startTransition(async () => {
      const result = await deleteComment({ commentId: id });
      if (result.status !== "ok") {
        showToast({ kind: "error", message: "Couldn't delete this comment. Try again." });
      }
    });
  }

  function handleDeleteGroupBlur(event: FocusEvent<HTMLFieldSetElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsConfirmingDelete(false);
    }
  }

  return (
    <div
      id={`comment-${id}`}
      className="flex gap-3">
      {/* biome-ignore lint/performance/noImgElement: avatarUrl is an arbitrary external URL, not an allow-listable domain for next/image */}
      <img
        src={actor.avatarUrl ?? undefined}
        alt={displayName}
        width={32}
        height={32}
        className="h-8 w-8 flex-none object-cover"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-baseline gap-2">
          <span className="text-control font-medium text-(--color-text)">{displayName}</span>
          <span className="text-label text-(--color-text-muted)">
            {formatRelativeTime(createdAt, new Date())}
          </span>
        </div>
        {isEditing ? (
          <TextField
            aria-label="Edit comment"
            value={draft}
            onChange={setDraft}
            isInvalid={error !== null}
            className="flex flex-col gap-1">
            <TextArea
              autoFocus
              onKeyDown={handleEditKeyDown}
              className="field-sizing-content min-h-[2.5rem] w-full resize-none border border-(--color-divider) bg-(--color-surface) px-3 py-2 text-control text-(--color-text)"
            />
            {error ? <FieldError>{error}</FieldError> : null}
          </TextField>
        ) : canEdit ? (
          <Button
            ref={editButtonRef}
            onPress={openEdit}
            aria-label="Edit comment"
            className="block w-full whitespace-pre-wrap text-start text-control text-(--color-text)">
            {optimisticBody}
          </Button>
        ) : (
          <p className="whitespace-pre-wrap text-control text-(--color-text)">{optimisticBody}</p>
        )}
        {canDelete ? (
          isConfirmingDelete ? (
            <fieldset
              aria-label="Confirm delete"
              onBlur={handleDeleteGroupBlur}
              className="m-0 flex gap-2 border-0 p-0">
              <Button
                onPress={confirmDelete}
                aria-label="Confirm delete">
                Confirm delete
              </Button>
              <Button onPress={cancelDelete}>Cancel</Button>
            </fieldset>
          ) : (
            <Button
              ref={deleteButtonRef}
              onPress={openDeleteConfirm}
              aria-label="Delete comment">
              Delete
            </Button>
          )
        ) : null}
      </div>
    </div>
  );
}