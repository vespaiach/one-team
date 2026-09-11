"use client";

import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { Button } from "react-aria-components/Button";
import { Form } from "react-aria-components/Form";
import { FieldError, Input, Label, TextField } from "react-aria-components/TextField";
import type { CreateProjectPayload, CreateProjectState } from "../actions";
import type { RosterEntry } from "../server/queries";
import { DateRangeFields } from "./date-range-fields";
import { MarkdownEditorField } from "./markdown-editor-field";
import { MemberPickerField } from "./member-picker-field";
import { ProjectKeyField } from "./project-key-field";

const INITIAL_STATE: CreateProjectState = { status: "idle" };

const KBD_CLASSES =
  "flex h-4.5 min-w-4.5 items-center justify-center rounded-sm border border-(--color-divider) px-1 font-mono text-caption";

export function CreateProjectForm({
  createProjectAction,
  checkKeyAvailability,
  candidates,
  onCancel,
}: {
  createProjectAction: (
    prevState: CreateProjectState,
    input: CreateProjectPayload,
  ) => Promise<CreateProjectState>;
  checkKeyAvailability: (key: string) => Promise<{ holder: { key: string; name: string } | null }>;
  candidates: RosterEntry[];
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(createProjectAction, INITIAL_STATE);

  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState<string | null>(null);
  const [targetDate, setTargetDate] = useState<string | null>(null);
  const [members, setMembers] = useState<RosterEntry[]>([]);

  const nameRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const nameMissing = nameTouched && name.trim() === "";
  const serverNameError = state.status === "invalid" && state.field === "name" ? "Name is required." : null;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload: CreateProjectPayload = {
      name: name.trim(),
      key,
      description: description.trim() === "" ? null : description,
      startDate,
      targetDate,
      memberIds: members.map((member) => member.userId),
    };
    startTransition(() => {
      formAction(payload);
    });
  }

  function handleCancel() {
    if (onCancel) {
      onCancel();
      return;
    }
    const referrer = document.referrer;
    if (referrer && new URL(referrer).origin === window.location.origin) {
      router.back();
      return;
    }
    router.push("/home");
  }

  useEffect(() => {
    const form = formRef.current;
    if (!form) {
      return;
    }
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        formRef.current?.requestSubmit();
      }
    }
    form.addEventListener("keydown", handleKeyDown);
    return () => form.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <Form
      ref={formRef}
      onSubmit={handleSubmit}
      validationBehavior="aria"
      className="flex flex-col gap-3">
      <TextField
        value={name}
        onChange={setName}
        onBlur={() => setNameTouched(true)}
        isRequired
        isInvalid={nameMissing || serverNameError !== null}
        className="flex flex-col gap-1">
        <Label className="sr-only">Project name</Label>
        <Input
          ref={nameRef}
          autoFocus
          placeholder="Project name"
          className="w-full border-0 bg-transparent p-0 font-heading text-h3 text-(--color-text) outline-none placeholder:text-(--color-text-placeholder)"
        />
        {(nameMissing || serverNameError) && <FieldError>Name is required.</FieldError>}
      </TextField>

      <ProjectKeyField
        name={name}
        onChange={setKey}
        checkAvailability={checkKeyAvailability}
      />
      {state.status === "key_taken" && (
        <p className="text-label text-(--color-accent-700)">{state.holder.name} already uses this key.</p>
      )}

      <MarkdownEditorField
        value={description}
        onChange={setDescription}
      />

      <div className="flex flex-wrap gap-2">
        <DateRangeFields
          startDate={startDate}
          targetDate={targetDate}
          onStartDateChange={setStartDate}
          onTargetDateChange={setTargetDate}
        />
        <MemberPickerField
          candidates={candidates}
          selected={members}
          onChange={setMembers}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          onPress={handleCancel}
          className="flex items-center gap-1.5 px-3 py-1.5 text-control text-(--color-text-muted) data-[hovered]:text-(--color-text)">
          Cancel
          <span className={KBD_CLASSES}>esc</span>
        </Button>
        <Button
          type="submit"
          className="flex items-center gap-1.5 bg-(--color-accent-fill) px-3 py-1.5 text-control text-(--color-on-accent) data-[hovered]:bg-(--color-accent-hover) data-[pressed]:bg-(--color-accent-pressed) data-[focus-visible]:outline-2 data-[focus-visible]:outline-offset-2 data-[focus-visible]:outline-(--color-accent)">
          {isPending ? "Creating…" : "Create project"}
          <span className={`${KBD_CLASSES} border-(--color-on-accent)/30`}>⌘</span>
          <span className={`${KBD_CLASSES} border-(--color-on-accent)/30`}>⏎</span>
        </Button>
      </div>
    </Form>
  );
}