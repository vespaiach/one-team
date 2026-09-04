"use client";

import type { KeyboardEvent } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { FieldError, TextArea, TextField } from "react-aria-components/TextField";
import { listMentionCandidates } from "../actions";
import { type MentionCandidate, MentionPicker } from "./mention-picker";

const MAX_COMMENT_BODY_LENGTH = 10000;

type ComposerTarget = { issueId: string } | { projectId: string };
type SelectedMention = { name: string; userId: string };
type MentionTrigger = { start: number; query: string };

function findMentionTrigger(value: string, cursor: number): MentionTrigger | null {
  const uptoCursor = value.slice(0, cursor);
  const at = uptoCursor.lastIndexOf("@");
  if (at === -1) {
    return null;
  }
  const query = uptoCursor.slice(at + 1);
  if (/\s/.test(query)) {
    return null;
  }
  const before = at === 0 ? "" : value[at - 1];
  if (before !== "" && before !== undefined && !/\s/.test(before)) {
    return null;
  }
  return { start: at, query };
}

function tokenizeMentions(text: string, mentions: SelectedMention[]): string {
  let result = text;
  for (const mention of mentions) {
    const index = result.indexOf(mention.name);
    if (index !== -1) {
      result = `${result.slice(0, index)}@[${mention.userId}]${result.slice(index + mention.name.length)}`;
    }
  }
  return result;
}

export function Composer({
  target,
  canPost,
  postReason,
  onSubmit,
}: {
  target: ComposerTarget;
  canPost: boolean;
  postReason: string | null;
  onSubmit: (body: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mentions, setMentions] = useState<SelectedMention[]>([]);
  const [pickerTrigger, setPickerTrigger] = useState<MentionTrigger | null>(null);
  const reasonId = useId();

  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const pendingCursorRef = useRef<number | null>(null);

  useEffect(() => {
    if (pendingCursorRef.current !== null && textAreaRef.current) {
      textAreaRef.current.setSelectionRange(pendingCursorRef.current, pendingCursorRef.current);
      pendingCursorRef.current = null;
    }
  });

  function submit() {
    const trimmed = draft.trim();
    if (trimmed === "") {
      setError("A comment can't be empty.");
      return;
    }
    const finalBody = tokenizeMentions(trimmed, mentions);
    if (finalBody.length > MAX_COMMENT_BODY_LENGTH) {
      setError(`Comments must be ${MAX_COMMENT_BODY_LENGTH.toLocaleString()} characters or fewer.`);
      return;
    }
    setError(null);
    setDraft("");
    setMentions([]);
    onSubmit(finalBody);
  }

  function handleChange(value: string) {
    setDraft(value);
    const cursor = textAreaRef.current ? (textAreaRef.current.selectionStart ?? value.length) : value.length;
    setPickerTrigger(findMentionTrigger(value, cursor));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      if (pickerTrigger !== null) {
        setPickerTrigger(null);
        return;
      }
      setDraft("");
      setMentions([]);
      setError(null);
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      setPickerTrigger(null);
      submit();
    }
  }

  function handleMentionSelect(candidate: MentionCandidate) {
    if (pickerTrigger === null) {
      return;
    }
    const name = `${candidate.firstName} ${candidate.lastName}`;
    const cursor = textAreaRef.current ? (textAreaRef.current.selectionStart ?? draft.length) : draft.length;
    const before = draft.slice(0, pickerTrigger.start);
    const after = draft.slice(cursor);

    pendingCursorRef.current = before.length + name.length;
    setDraft(`${before}${name}${after}`);
    setMentions((previous) => [...previous, { name, userId: candidate.id }]);
    setPickerTrigger(null);
  }

  return (
    <div className="flex flex-col gap-1">
      <TextField
        aria-label="Comment"
        value={draft}
        onChange={handleChange}
        isDisabled={!canPost}
        isInvalid={error !== null}
        aria-describedby={canPost ? undefined : reasonId}
        className="flex flex-col gap-1">
        <TextArea
          ref={textAreaRef}
          onKeyDown={handleKeyDown}
          className="field-sizing-content min-h-[2.5rem] w-full resize-none border border-(--color-divider) bg-(--color-surface) px-3 py-2 text-control text-(--color-text)"
        />
        {error ? <FieldError>{error}</FieldError> : null}
      </TextField>
      {!canPost && postReason ? (
        <p
          id={reasonId}
          className="text-label text-(--color-text-muted)">
          {postReason}
        </p>
      ) : null}
      {pickerTrigger !== null ? (
        <MentionPicker
          target={target}
          query={pickerTrigger.query}
          triggerRef={textAreaRef}
          listCandidates={listMentionCandidates}
          onSelect={handleMentionSelect}
          onClose={() => setPickerTrigger(null)}
        />
      ) : null}
    </div>
  );
}