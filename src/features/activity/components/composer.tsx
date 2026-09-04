"use client";

import type { KeyboardEvent } from "react";
import { useId, useState } from "react";
import { FieldError, TextArea, TextField } from "react-aria-components/TextField";

const MAX_COMMENT_BODY_LENGTH = 10000;

export function Composer({
  canPost,
  postReason,
  onSubmit,
}: {
  canPost: boolean;
  postReason: string | null;
  onSubmit: (body: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const reasonId = useId();

  function submit() {
    const trimmed = draft.trim();
    if (trimmed === "") {
      setError("A comment can't be empty.");
      return;
    }
    if (trimmed.length > MAX_COMMENT_BODY_LENGTH) {
      setError(`Comments must be ${MAX_COMMENT_BODY_LENGTH.toLocaleString()} characters or fewer.`);
      return;
    }
    setError(null);
    setDraft("");
    onSubmit(trimmed);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      submit();
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <TextField
        aria-label="Comment"
        value={draft}
        onChange={setDraft}
        isDisabled={!canPost}
        isInvalid={error !== null}
        aria-describedby={canPost ? undefined : reasonId}
        className="flex flex-col gap-1">
        <TextArea
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
    </div>
  );
}