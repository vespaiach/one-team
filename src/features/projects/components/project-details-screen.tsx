"use client";

import { type CalendarDate, parseDate } from "@internationalized/date";
import { DateInput, DatePicker, DateSegment, Group } from "react-aria-components/DatePicker";
import type { UpdateProjectPayload, UpdateProjectState } from "../actions";
import type { ProjectDetails } from "../server/queries";
import { ColumnsSection } from "./columns-section";
import { DescriptionView } from "./description-view";
import type { EditableFieldEditorProps } from "./editable-field";
import { EditableField } from "./editable-field";
import { MembersSection } from "./members-section";

function toCalendarDate(value: string): CalendarDate | null {
  return value ? parseDate(value) : null;
}

function DateFieldEditor({
  label,
  value,
  onChange,
  onKeyDown,
  onBlur,
}: EditableFieldEditorProps & { label: string }) {
  return (
    <DatePicker
      autoFocus
      aria-label={label}
      value={toCalendarDate(value)}
      onChange={(next) => onChange(next ? next.toString() : "")}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
      className="flex flex-col gap-1">
      <Group>
        <DateInput>{(segment) => <DateSegment segment={segment} />}</DateInput>
      </Group>
    </DatePicker>
  );
}

export function ProjectDetailsScreen({
  details,
  updateProjectAction,
}: {
  details: ProjectDetails;
  updateProjectAction: (input: UpdateProjectPayload) => Promise<UpdateProjectState>;
}) {
  const { record, columns, roster, canEditRecord } = details;
  const disabledReason = canEditRecord ? undefined : `Join ${record.name} to make changes.`;

  function saveField(changes: UpdateProjectPayload["changes"]) {
    return updateProjectAction({ projectKey: record.key, changes });
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      <section className="flex flex-col gap-3">
        <div>
          <span className="text-label text-(--color-text-muted)">Key</span>
          <p>{record.key} — this can&apos;t be changed.</p>
        </div>
        <EditableField
          label="Name"
          value={record.name}
          isDisabled={!canEditRecord}
          disabledReason={disabledReason}
          onSave={(value) => saveField({ name: value })}
        />
        <DescriptionView
          description={record.description}
          isDisabled={!canEditRecord}
          disabledReason={disabledReason}
          onSave={(value) => saveField({ description: value })}
        />
        <EditableField
          label="Start date"
          value={record.startDate}
          placeholder="Add a start date"
          isDisabled={!canEditRecord}
          disabledReason={disabledReason}
          renderEditor={(props) => (
            <DateFieldEditor
              label="Start date"
              {...props}
            />
          )}
          onSave={(value) => saveField({ startDate: value === "" ? null : value })}
        />
        <EditableField
          label="Target date"
          value={record.targetDate}
          placeholder="Add a target date"
          isDisabled={!canEditRecord}
          disabledReason={disabledReason}
          renderEditor={(props) => (
            <DateFieldEditor
              label="Target date"
              {...props}
            />
          )}
          onSave={(value) => saveField({ targetDate: value === "" ? null : value })}
        />
      </section>
      <ColumnsSection columns={columns} />
      <MembersSection roster={roster} />
    </div>
  );
}