"use client";

import { useState, useTransition } from "react";
import { Button } from "react-aria-components/Button";
import { Form } from "react-aria-components/Form";
import { FieldError, Input, Label, TextField } from "react-aria-components/TextField";
import type { CreateColumnState } from "../column-actions";

const MAX_NAME_LENGTH = 200;

function localNameError(value: string): string | null {
  const name = value.trim();
  if (name === "") {
    return "Column name is required.";
  }
  if (name.length > MAX_NAME_LENGTH) {
    return "Column name is too long.";
  }
  return null;
}

function refusalMessage(state: Exclude<CreateColumnState, { ok: true }>): string {
  switch (state.error) {
    case "duplicate_name":
      return `That name is already taken by the column ${state.holder.name}.`;
    case "invalid_name":
      return state.reason === "required" ? "Column name is required." : "Column name is too long.";
    default:
      return "That column wasn't added — only an admin can add a project's columns.";
  }
}

export function AddColumnForm({
  projectKey,
  createColumn,
}: {
  projectKey: string;
  createColumn: (input: { projectKey: string; name: string }) => Promise<CreateColumnState>;
}) {
  const [name, setName] = useState("");
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const error = serverError ?? (touched ? localNameError(name) : null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched(true);
    setServerError(null);

    if (localNameError(name)) {
      return;
    }

    startTransition(async () => {
      const result = await createColumn({ projectKey, name: name.trim() });
      if (result.ok) {
        setName("");
        setTouched(false);
        return;
      }
      setServerError(refusalMessage(result));
    });
  }

  return (
    <Form
      onSubmit={handleSubmit}
      className="flex items-end gap-2">
      <TextField
        value={name}
        onChange={(next) => {
          setName(next);
          setServerError(null);
        }}
        onBlur={() => setTouched(true)}
        isInvalid={error !== null}
        className="flex flex-col gap-[5px]">
        <Label>Column name</Label>
        <Input className="w-full border border-(--color-divider) bg-(--color-surface) px-3 py-2 text-control text-(--color-text)" />
        <FieldError>{error}</FieldError>
      </TextField>
      <Button
        type="submit"
        isPending={isPending}
        className="border border-(--color-divider) px-3 py-2 text-control data-[hovered]:bg-(--color-surface-hover) data-[pressed]:bg-(--color-surface) data-[focus-visible]:outline-2 data-[focus-visible]:outline-(--color-accent)">
        {isPending ? "Adding…" : "Add column"}
      </Button>
    </Form>
  );
}