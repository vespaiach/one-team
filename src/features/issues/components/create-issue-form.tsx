"use client";

import { useRouter } from "next/navigation";
import { useActionState, useRef, useState } from "react";
import { Button } from "react-aria-components/Button";
import { Form } from "react-aria-components/Form";
import { ListBox, ListBoxItem } from "react-aria-components/ListBox";
import { Popover } from "react-aria-components/Popover";
import { Select, SelectValue } from "react-aria-components/Select";
import { FieldError, Input, Label, TextArea, TextField } from "react-aria-components/TextField";
import { LabelPickerField } from "@/features/labels/components/label-picker-field";
import type { LabelOption } from "@/features/labels/server/queries";
import type { CreateIssueState } from "../actions";
import type { AssigneeOption, IssueColumnOption } from "../server/issue-queries";

const INITIAL_STATE: CreateIssueState = { status: "idle" };
const UNASSIGNED = "";
const TITLE_MAX_LENGTH = 200;
const DESCRIPTION_MAX_LENGTH = 10000;

const PRIORITIES: { id: "none" | "low" | "medium" | "high" | "urgent"; label: string }[] = [
  { id: "none", label: "No priority" },
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
  { id: "urgent", label: "Urgent" },
];

function validateTitle(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === "") {
    return "Title is required.";
  }
  if (trimmed.length > TITLE_MAX_LENGTH) {
    return `Title must be ${TITLE_MAX_LENGTH} characters or fewer.`;
  }
  return null;
}

function validateDescription(value: string): string | null {
  if (value.length > DESCRIPTION_MAX_LENGTH) {
    return `Description must be ${DESCRIPTION_MAX_LENGTH.toLocaleString()} characters or fewer.`;
  }
  return null;
}

export function CreateIssueForm({
  projectId,
  projectKey,
  columns,
  assigneePool,
  createIssueAction,
  labelOptions = [],
  canManageLabels = false,
}: {
  projectId: string;
  projectKey: string;
  columns: IssueColumnOption[];
  assigneePool: AssigneeOption[];
  createIssueAction: (prevState: CreateIssueState, formData: FormData) => Promise<CreateIssueState>;
  labelOptions?: LabelOption[];
  canManageLabels?: boolean;
}) {
  const router = useRouter();
  const [, formAction, isPending] = useActionState(createIssueAction, INITIAL_STATE);

  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [descriptionTouched, setDescriptionTouched] = useState(false);
  const [columnId, setColumnId] = useState(columns[0]?.id ?? "");
  const [priority, setPriority] = useState<"none" | "low" | "medium" | "high" | "urgent">("none");
  const [assigneeId, setAssigneeId] = useState(UNASSIGNED);
  const [dueDate, setDueDate] = useState("");
  const [selectedLabelIds, setSelectedLabelIds] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);

  const titleRef = useRef<HTMLInputElement>(null);

  const titleError = titleTouched || submitted ? validateTitle(title) : null;
  const descriptionError = descriptionTouched || submitted ? validateDescription(description) : null;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    setSubmitted(true);
    const titleProblem = validateTitle(title);
    const descriptionProblem = validateDescription(description);
    if (titleProblem || descriptionProblem) {
      event.preventDefault();
      if (titleProblem) {
        titleRef.current?.focus();
      }
    }
  }

  function handleCancel() {
    router.push(`/projects/${projectKey}/details`);
  }

  function handleLabelToggle(labelId: string, applied: boolean) {
    setSelectedLabelIds((current) => {
      const next = new Set(current);
      if (applied) {
        next.add(labelId);
      } else {
        next.delete(labelId);
      }
      return next;
    });
  }

  const pickerOptions = labelOptions.map((option) => ({
    ...option,
    applied: selectedLabelIds.has(option.id),
  }));

  return (
    <Form
      action={formAction}
      onSubmit={handleSubmit}
      validationBehavior="aria"
      className="flex flex-col gap-[14px]">
      <input
        type="hidden"
        name="projectId"
        value={projectId}
      />

      <TextField
        name="title"
        value={title}
        onChange={setTitle}
        onBlur={() => setTitleTouched(true)}
        isRequired
        isInvalid={titleError !== null}
        className="flex flex-col gap-[5px]">
        <Label>Title</Label>
        <Input
          ref={titleRef}
          autoFocus
        />
        {titleError && <FieldError>{titleError}</FieldError>}
      </TextField>

      <TextField
        name="description"
        value={description}
        onChange={setDescription}
        onBlur={() => setDescriptionTouched(true)}
        isInvalid={descriptionError !== null}
        className="flex flex-col gap-[5px]">
        <Label>Description</Label>
        <TextArea className="max-h-[280px] w-full resize-none overflow-y-auto border border-(--color-divider) bg-(--color-surface) px-3 py-2 text-control text-(--color-text)" />
        {descriptionError && <FieldError>{descriptionError}</FieldError>}
      </TextField>

      <Select
        name="columnId"
        selectedKey={columnId}
        onSelectionChange={(key) => setColumnId(String(key))}
        className="flex flex-col gap-[5px]">
        <Label>Column</Label>
        <Button>
          <SelectValue />
        </Button>
        <Popover>
          <ListBox>
            {columns.map((column) => (
              <ListBoxItem
                key={column.id}
                id={column.id}
                textValue={column.name}>
                {column.name}
              </ListBoxItem>
            ))}
          </ListBox>
        </Popover>
      </Select>

      <Select
        name="priority"
        selectedKey={priority}
        onSelectionChange={(key) => setPriority(key as typeof priority)}
        className="flex flex-col gap-[5px]">
        <Label>Priority</Label>
        <Button>
          <SelectValue />
        </Button>
        <Popover>
          <ListBox>
            {PRIORITIES.map((item) => (
              <ListBoxItem
                key={item.id}
                id={item.id}
                textValue={item.label}>
                {item.label}
              </ListBoxItem>
            ))}
          </ListBox>
        </Popover>
      </Select>

      <LabelPickerField
        options={pickerOptions}
        onToggle={handleLabelToggle}
        canManageLabels={canManageLabels}
      />
      {Array.from(selectedLabelIds).map((id) => (
        <input
          key={id}
          type="hidden"
          name="labelIds"
          value={id}
        />
      ))}

      <Select
        name="assigneeId"
        selectedKey={assigneeId}
        onSelectionChange={(key) => setAssigneeId(String(key))}
        className="flex flex-col gap-[5px]">
        <Label>Assignee</Label>
        <Button>
          <SelectValue />
        </Button>
        <Popover>
          <ListBox>
            <ListBoxItem
              id={UNASSIGNED}
              textValue="Unassigned">
              Unassigned
            </ListBoxItem>
            {assigneePool.map((person) => (
              <ListBoxItem
                key={person.id}
                id={person.id}
                textValue={`${person.firstName} ${person.lastName}`}>
                {person.firstName} {person.lastName}
              </ListBoxItem>
            ))}
          </ListBox>
        </Popover>
      </Select>

      <div className="flex flex-col gap-[5px]">
        <label
          htmlFor="create-issue-due-date"
          className="text-label text-(--color-text-muted)">
          Due date
        </label>
        <input
          id="create-issue-due-date"
          type="date"
          name="dueDate"
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
          className="h-[36px] border border-(--color-divider) bg-(--color-surface) px-3 text-control text-(--color-text)"
        />
      </div>

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