"use client";

import { useRouter } from "next/navigation";
import { startTransition, useActionState, useRef, useState } from "react";
import { Button } from "react-aria-components/Button";
import { Form } from "react-aria-components/Form";
import { FieldError, Input, Label, TextArea, TextField } from "react-aria-components/TextField";
import type { CreateProjectPayload, CreateProjectState } from "../actions";
import type { RosterEntry } from "../server/queries";
import { DateRangeFields } from "./date-range-fields";
import { MemberPickerField } from "./member-picker-field";
import { ProjectKeyField } from "./project-key-field";

const INITIAL_STATE: CreateProjectState = { status: "idle" };

export function CreateProjectForm({
  createProjectAction,
  checkKeyAvailability,
  candidates,
}: {
  createProjectAction: (
    prevState: CreateProjectState,
    input: CreateProjectPayload,
  ) => Promise<CreateProjectState>;
  checkKeyAvailability: (key: string) => Promise<{ holder: { key: string; name: string } | null }>;
  candidates: RosterEntry[];
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
    const referrer = document.referrer;
    if (referrer && new URL(referrer).origin === window.location.origin) {
      router.back();
      return;
    }
    router.push("/home");
  }

  return (
    <Form
      onSubmit={handleSubmit}
      validationBehavior="aria"
      className="flex flex-col gap-[14px]">
      <TextField
        value={name}
        onChange={setName}
        onBlur={() => setNameTouched(true)}
        isRequired
        isInvalid={nameMissing || serverNameError !== null}
        className="flex flex-col gap-[5px]">
        <Label>Name</Label>
        <Input
          ref={nameRef}
          autoFocus
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

      <TextField
        value={description}
        onChange={setDescription}
        className="flex flex-col gap-[5px]">
        <Label>Description</Label>
        <TextArea className="max-h-[280px] w-full resize-none overflow-y-auto border border-(--color-divider) bg-(--color-surface) px-3 py-2 text-control text-(--color-text)" />
      </TextField>

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

      <div className="flex justify-end gap-[8px]">
        <Button
          type="button"
          onPress={handleCancel}>
          Cancel
        </Button>
        <Button type="submit">{isPending ? "Creating…" : "Create"}</Button>
      </div>
    </Form>
  );
}