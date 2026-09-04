"use client";

import { type CalendarDate, parseDate } from "@internationalized/date";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { DateInput, DatePicker, DateSegment, Group } from "react-aria-components/DatePicker";
import { Feed } from "@/features/activity/components/feed";
import { FeedSkeleton } from "@/features/activity/components/feed-skeleton";
import type { FeedPage } from "@/features/activity/server/feed-queries";
import type {
  DeleteProjectPayload,
  DeleteProjectState,
  SetProjectStatusPayload,
  SetProjectStatusState,
  UpdateProjectPayload,
  UpdateProjectState,
} from "../actions";
import type { ProjectDetails, RosterEntry } from "../server/queries";
import { ColumnsSection } from "./columns-section";
import { DeleteProjectControl } from "./delete-project-control";
import { DescriptionView } from "./description-view";
import type { EditableFieldEditorProps } from "./editable-field";
import { EditableField } from "./editable-field";
import type { MembershipActionResult, MembershipPayload } from "./members-section";
import { MembersSection } from "./members-section";
import { ProjectHeader } from "./project-header";
import { StatusSwitch } from "./status-switch";

type Viewer = { id: string; firstName: string; lastName: string; avatarUrl: string | null };

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

export type ProjectDetailsScreenAdmin = {
  candidates: RosterEntry[];
  addProjectMemberAction: (input: MembershipPayload) => Promise<MembershipActionResult>;
  removeProjectMemberAction: (input: MembershipPayload) => Promise<MembershipActionResult>;
  setProjectStatusAction: (input: SetProjectStatusPayload) => Promise<SetProjectStatusState>;
  deleteProjectAction: (input: DeleteProjectPayload) => Promise<DeleteProjectState>;
};

export function ProjectDetailsScreen({
  details,
  updateProjectAction,
  admin,
  newIssue,
  feedProjectId = null,
  feedInitialPage = { rows: [], hasNextPage: false },
  canComment = false,
  commentPostReason = null,
  viewer = null,
}: {
  details: ProjectDetails;
  updateProjectAction: (input: UpdateProjectPayload) => Promise<UpdateProjectState>;
  admin?: ProjectDetailsScreenAdmin;
  newIssue?: ReactNode;
  feedProjectId?: string | null;
  feedInitialPage?: FeedPage;
  canComment?: boolean;
  commentPostReason?: string | null;
  viewer?: Viewer | null;
}) {
  const { record, columns, roster, canEditRecord } = details;
  const disabledReason = canEditRecord ? undefined : `Join ${record.name} to make changes.`;
  const adminDisabledReason = "Only admins can change a project's status.";
  const deleteDisabledReason = !admin
    ? "Only admins can delete a project."
    : record.status !== "archived"
      ? `Archive ${record.name} before deleting it.`
      : undefined;

  function saveField(changes: UpdateProjectPayload["changes"]) {
    return updateProjectAction({ projectKey: record.key, changes });
  }

  function saveStatus(nextStatus: "active" | "archived"): Promise<SetProjectStatusState> {
    if (!admin) {
      return Promise.resolve({ status: "forbidden" });
    }
    return admin.setProjectStatusAction({ projectKey: record.key, status: nextStatus });
  }

  function runDelete(): Promise<DeleteProjectState> {
    if (!admin) {
      return Promise.resolve({ status: "forbidden" });
    }
    return admin.deleteProjectAction({ projectKey: record.key });
  }

  return (
    <>
      <ProjectHeader
        projectKey={record.key}
        name={record.name}
        current="details"
        newIssue={newIssue}
      />
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
          <StatusSwitch
            status={record.status}
            isDisabled={!admin}
            disabledReason={admin ? undefined : adminDisabledReason}
            onSave={saveStatus}
          />
        </section>
        <ColumnsSection columns={columns} />
        <MembersSection
          roster={roster}
          admin={
            admin
              ? {
                  projectKey: record.key,
                  candidates: admin.candidates,
                  addProjectMemberAction: admin.addProjectMemberAction,
                  removeProjectMemberAction: admin.removeProjectMemberAction,
                }
              : undefined
          }
        />
        <DeleteProjectControl
          projectName={record.name}
          cascadeCount={details.cascadeCount}
          isDisabled={!admin || record.status !== "archived"}
          disabledReason={deleteDisabledReason}
          onDelete={runDelete}
        />
        {feedProjectId && viewer ? (
          <Suspense fallback={<FeedSkeleton />}>
            <Feed
              target={{ projectId: feedProjectId }}
              initialPage={feedInitialPage}
              canPost={canComment}
              postReason={commentPostReason}
              viewer={viewer}
            />
          </Suspense>
        ) : null}
      </div>
    </>
  );
}