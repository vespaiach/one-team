"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "react-aria-components/Button";
import { FieldError, Input, TextField } from "react-aria-components/TextField";
import type { CreateIssueResult } from "@/features/issues/server/create-issue";
import type { Grouping } from "../lane-model";

const ADD_A_CARD = "Add a card";
const OPEN_THE_FULL_FORM = "Open the full form";
const TITLE_REQUIRED = "Title is required.";
const TITLE_TOO_LONG = "Title must be 200 characters or fewer.";
const CREATE_REFUSED = "That card wasn't created.";
const CREATE_FAILED = "That card wasn't created — the connection was lost. Try again.";

export type CardComposerPayload = {
  projectId: string;
  title: string;
  columnId: string;
  assigneeId?: string;
  priority?: string;
};

export type CardComposerProps = {
  projectId: string;
  projectKey: string;
  grouping: Grouping;
  laneId: string | null;
  firstColumnId: string;
  canWrite: boolean;
  writeReason: string;
  laneName: string;
  laneAcceptsWrite: boolean;
  onCreate: (payload: CardComposerPayload) => Promise<CreateIssueResult>;
};

function refusalOnField(result: CreateIssueResult): string | null {
  if (result.status === "ok") {
    return null;
  }
  if (result.status === "forbidden") {
    return result.reason;
  }
  if (result.status === "invalid" && result.field === "title") {
    return result.reason === "too-long" ? TITLE_TOO_LONG : TITLE_REQUIRED;
  }
  return CREATE_REFUSED;
}

function outsidePoolReason(laneName: string): string {
  return `${laneName} isn't in this project's assignee pool, so a card can't be added here.`;
}

function payloadFor(
  { projectId, grouping, laneId, firstColumnId }: CardComposerProps,
  title: string,
): CardComposerPayload {
  if (grouping === "assignee") {
    return laneId === null
      ? { projectId, title, columnId: firstColumnId }
      : { projectId, title, columnId: firstColumnId, assigneeId: laneId };
  }
  if (grouping === "priority") {
    return laneId === null
      ? { projectId, title, columnId: firstColumnId }
      : { projectId, title, columnId: firstColumnId, priority: laneId };
  }
  return { projectId, title, columnId: laneId ?? firstColumnId };
}

function fullFormHref(props: CardComposerProps, title: string): string {
  const { columnId, assigneeId, priority } = payloadFor(props, title);
  const preselection = new URLSearchParams();
  if (title !== "") {
    preselection.set("title", title);
  }
  if (columnId !== "") {
    preselection.set("columnId", columnId);
  }
  if (assigneeId !== undefined) {
    preselection.set("assigneeId", assigneeId);
  }
  if (priority !== undefined) {
    preselection.set("priority", priority);
  }
  const query = preselection.toString();
  const path = `/projects/${props.projectKey}/issues/new`;
  return query === "" ? path : `${path}?${query}`;
}

function refusalReason({
  canWrite,
  writeReason,
  laneName,
  laneAcceptsWrite,
}: CardComposerProps): string | null {
  if (!canWrite) {
    return writeReason;
  }
  return laneAcceptsWrite ? null : outsidePoolReason(laneName);
}

export function CardComposer(props: CardComposerProps) {
  const { onCreate } = props;
  const router = useRouter();
  const disabledReason = refusalReason(props);
  const label = disabledReason ?? ADD_A_CARD;
  const chevronLabel = disabledReason ?? OPEN_THE_FULL_FORM;
  const [title, setTitle] = useState("");
  const [refusal, setRefusal] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    if (disabledReason !== null) {
      return;
    }
    const trimmed = title.trim();
    if (trimmed === "") {
      setRefusal(TITLE_REQUIRED);
      return;
    }
    setRefusal(null);
    setPending(true);
    try {
      const refused = refusalOnField(await onCreate(payloadFor(props, trimmed)));
      setRefusal(refused);
      if (refused === null) {
        setTitle("");
      }
    } catch {
      setRefusal(CREATE_FAILED);
    } finally {
      setPending(false);
    }
  }

  function openFullForm() {
    if (disabledReason !== null) {
      return;
    }
    router.push(fullFormHref(props, title.trim()));
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    if (event.shiftKey) {
      openFullForm();
      return;
    }
    void submit();
  }

  return (
    <div
      data-region="composer"
      className="flex items-center gap-2">
      <TextField
        aria-label={label}
        value={title}
        onChange={setTitle}
        isDisabled={pending || disabledReason !== null}
        isInvalid={refusal !== null}
        className="flex flex-1 flex-col gap-[5px]">
        <Input
          placeholder={label}
          onKeyDown={handleKeyDown}
          className="w-full border border-(--color-divider) bg-(--color-surface) px-3 py-2 text-control text-(--color-text) data-[focus-visible]:outline-2 data-[focus-visible]:outline-(--color-accent)"
        />
        {refusal !== null && <FieldError>{refusal}</FieldError>}
      </TextField>
      <Button
        aria-label={chevronLabel}
        isDisabled={pending || disabledReason !== null}
        onPress={openFullForm}
        className="border border-(--color-divider) px-2 py-2 text-control text-(--color-text) data-[disabled]:text-(--color-text-muted) data-[focus-visible]:outline-2 data-[focus-visible]:outline-(--color-accent)">
        ›
      </Button>
      {pending && <span className="text-label text-(--color-text-muted)">Adding…</span>}
    </div>
  );
}