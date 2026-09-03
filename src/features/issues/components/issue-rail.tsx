"use client";

import { useOptimistic, useTransition } from "react";
import { Button } from "react-aria-components/Button";
import { Label } from "react-aria-components/Label";
import { ListBox, ListBoxItem } from "react-aria-components/ListBox";
import { Popover } from "react-aria-components/Popover";
import { Select, SelectValue } from "react-aria-components/Select";
import { Text } from "react-aria-components/Text";
import type { IssueLabelPayload, IssueLabelResult } from "@/features/labels/actions";
import { LabelPickerField } from "@/features/labels/components/label-picker-field";
import type { LabelOption } from "@/features/labels/server/queries";
import { showToast } from "@/features/shell/components/toast-region";
import type { UpdateIssuePayload, UpdateIssueResult } from "../actions";
import type { IssuePriority } from "../server/input";
import type { AssigneeOption, IssueColumnOption, PublicUser } from "../server/issue-queries";

async function noopIssueLabelAction(): Promise<IssueLabelResult> {
  return { ok: false, error: "not_found" };
}

const UNASSIGNED = "";

const PRIORITIES: { id: IssuePriority; label: string }[] = [
  { id: "none", label: "No priority" },
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
  { id: "urgent", label: "Urgent" },
];

function describeLabelRefusal(result: IssueLabelResult): string {
  if (result.ok) {
    return "";
  }
  if (result.error === "forbidden") {
    return result.reason;
  }
  if (result.error === "label_not_found") {
    return "That label isn't available anymore.";
  }
  return "Couldn't change labels. Try again.";
}

function describeRefusal(result: UpdateIssueResult, label: string): string {
  if (result.status === "forbidden") {
    return result.reason;
  }
  if (result.status === "invalid") {
    switch (result.reason) {
      case "not-a-member-of-this-project":
        return "That person can't be assigned in this project.";
      case "unknown-value":
        return `That ${label.toLowerCase()} isn't available anymore.`;
      case "malformed":
        return `That ${label.toLowerCase()} isn't valid.`;
      case "required":
        return `${label} is required.`;
      case "too-long":
        return `${label} is too long.`;
    }
  }
  return `Couldn't change the ${label.toLowerCase()}. Try again.`;
}

export function IssueRail({
  issueId,
  column,
  priority,
  assignee,
  dueDate,
  columns,
  assigneePool,
  canWrite = true,
  writeReason = "",
  updateIssueAction,
  labelOptions = [],
  canManageLabels = false,
  addIssueLabelAction = noopIssueLabelAction,
  removeIssueLabelAction = noopIssueLabelAction,
}: {
  issueId: string;
  column: { id: string; name: string };
  priority: IssuePriority;
  assignee: PublicUser | null;
  dueDate: string | null;
  columns: IssueColumnOption[];
  assigneePool: AssigneeOption[];
  canWrite?: boolean;
  writeReason?: string;
  updateIssueAction: (input: UpdateIssuePayload) => Promise<UpdateIssueResult>;
  labelOptions?: LabelOption[];
  canManageLabels?: boolean;
  addIssueLabelAction?: (input: IssueLabelPayload) => Promise<IssueLabelResult>;
  removeIssueLabelAction?: (input: IssueLabelPayload) => Promise<IssueLabelResult>;
}) {
  const [optimisticColumnId, setOptimisticColumnId] = useOptimistic(column.id);
  const [optimisticPriority, setOptimisticPriority] = useOptimistic(priority);
  const [optimisticAssigneeId, setOptimisticAssigneeId] = useOptimistic(assignee?.id ?? UNASSIGNED);
  const [optimisticDueDate, setOptimisticDueDate] = useOptimistic(dueDate ?? "");
  const [optimisticAppliedLabelIds, setOptimisticAppliedLabelIds] = useOptimistic(
    new Set(labelOptions.filter((option) => option.applied).map((option) => option.id)),
  );
  const [, startTransition] = useTransition();

  function handleColumnChange(nextColumnId: string) {
    if (nextColumnId === optimisticColumnId) {
      return;
    }
    startTransition(async () => {
      setOptimisticColumnId(nextColumnId);
      const result = await updateIssueAction({ issueId, columnId: nextColumnId });
      if (result.status !== "ok") {
        showToast({ kind: "error", message: describeRefusal(result, "Column") });
      }
    });
  }

  function handlePriorityChange(nextPriority: IssuePriority) {
    if (nextPriority === optimisticPriority) {
      return;
    }
    startTransition(async () => {
      setOptimisticPriority(nextPriority);
      const result = await updateIssueAction({ issueId, priority: nextPriority });
      if (result.status !== "ok") {
        showToast({ kind: "error", message: describeRefusal(result, "Priority") });
      }
    });
  }

  function handleAssigneeChange(nextAssigneeId: string) {
    if (nextAssigneeId === optimisticAssigneeId) {
      return;
    }
    startTransition(async () => {
      setOptimisticAssigneeId(nextAssigneeId);
      const result = await updateIssueAction({
        issueId,
        assigneeId: nextAssigneeId === UNASSIGNED ? null : nextAssigneeId,
      });
      if (result.status !== "ok") {
        showToast({ kind: "error", message: describeRefusal(result, "Assignee") });
      }
    });
  }

  function handleDueDateChange(nextDueDate: string) {
    if (nextDueDate === optimisticDueDate) {
      return;
    }
    startTransition(async () => {
      setOptimisticDueDate(nextDueDate);
      const result = await updateIssueAction({ issueId, dueDate: nextDueDate === "" ? null : nextDueDate });
      if (result.status !== "ok") {
        showToast({ kind: "error", message: describeRefusal(result, "Due date") });
      }
    });
  }

  function handleLabelToggle(labelId: string, applied: boolean) {
    startTransition(async () => {
      setOptimisticAppliedLabelIds((current) => {
        const next = new Set(current);
        if (applied) {
          next.add(labelId);
        } else {
          next.delete(labelId);
        }
        return next;
      });
      const result = applied
        ? await addIssueLabelAction({ issueId, labelId })
        : await removeIssueLabelAction({ issueId, labelId });
      if (!result.ok) {
        showToast({ kind: "error", message: describeLabelRefusal(result) });
      }
    });
  }

  const optimisticLabelOptions = labelOptions.map((option) => ({
    ...option,
    applied: optimisticAppliedLabelIds.has(option.id),
  }));

  return (
    <div className="flex flex-col gap-4">
      <Select
        selectedKey={optimisticColumnId}
        onSelectionChange={(key) => handleColumnChange(String(key))}
        isDisabled={!canWrite}
        className="flex flex-col gap-[5px]">
        <Label>Column</Label>
        <Button>
          <SelectValue />
        </Button>
        {!canWrite ? <Text slot="description">{writeReason}</Text> : null}
        <Popover>
          <ListBox>
            {columns.map((option) => (
              <ListBoxItem
                key={option.id}
                id={option.id}
                textValue={option.name}>
                {option.name}
              </ListBoxItem>
            ))}
          </ListBox>
        </Popover>
      </Select>

      <Select
        selectedKey={optimisticPriority}
        onSelectionChange={(key) => handlePriorityChange(key as IssuePriority)}
        isDisabled={!canWrite}
        className="flex flex-col gap-[5px]">
        <Label>Priority</Label>
        <Button>
          <SelectValue />
        </Button>
        {!canWrite ? <Text slot="description">{writeReason}</Text> : null}
        <Popover>
          <ListBox>
            {PRIORITIES.map((option) => (
              <ListBoxItem
                key={option.id}
                id={option.id}
                textValue={option.label}>
                {option.label}
              </ListBoxItem>
            ))}
          </ListBox>
        </Popover>
      </Select>

      <Select
        selectedKey={optimisticAssigneeId}
        onSelectionChange={(key) => handleAssigneeChange(String(key))}
        isDisabled={!canWrite}
        className="flex flex-col gap-[5px]">
        <Label>Assignee</Label>
        <Button>
          <SelectValue />
        </Button>
        {!canWrite ? <Text slot="description">{writeReason}</Text> : null}
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
          htmlFor="issue-rail-due-date"
          className="text-label text-(--color-text-muted)">
          Due date
        </label>
        <input
          id="issue-rail-due-date"
          type="date"
          value={optimisticDueDate}
          onChange={(event) => handleDueDateChange(event.target.value)}
          disabled={!canWrite}
          aria-describedby={canWrite ? undefined : "issue-rail-due-date-reason"}
          className="h-[36px] border border-(--color-divider) bg-(--color-surface) px-3 text-control text-(--color-text)"
        />
        {!canWrite ? (
          <p
            id="issue-rail-due-date-reason"
            className="text-label text-(--color-text-muted)">
            {writeReason}
          </p>
        ) : null}
      </div>

      <LabelPickerField
        options={optimisticLabelOptions}
        onToggle={handleLabelToggle}
        canManageLabels={canManageLabels}
        isDisabled={!canWrite}
        disabledReason={writeReason}
      />
    </div>
  );
}