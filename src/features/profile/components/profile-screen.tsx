import { displayName } from "@/lib/display-name";
import type { ProfileRecord } from "../server/queries";
import { AvatarPreview } from "./avatar-preview";
import { ChangePasswordLink } from "./change-password-link";
import { EditableField } from "./editable-field";
import { ShownValue } from "./shown-value";

export function ProfileScreen({ record }: { record: ProfileRecord }) {
  const name = displayName(record);

  return (
    <div className="flex flex-col gap-5 p-4.5">
      <div
        data-row="avatar"
        className="flex flex-col gap-2">
        <AvatarPreview
          avatarUrl={record.avatarUrl}
          name={name}
        />
        <EditableField
          field="avatarUrl"
          label="Avatar"
          value={record.avatarUrl}
          placeholder="Add an avatar link"
        />
      </div>
      <div data-row="firstName">
        <EditableField
          field="firstName"
          label="First name"
          value={record.firstName}
          required
        />
      </div>
      <div data-row="lastName">
        <EditableField
          field="lastName"
          label="Last name"
          value={record.lastName}
          required
        />
      </div>
      <div data-row="jobTitle">
        <EditableField
          field="jobTitle"
          label="Job title"
          value={record.jobTitle}
          placeholder="Add a job title"
        />
      </div>
      <div data-row="slackHandle">
        <EditableField
          field="slackHandle"
          label="Slack handle"
          value={record.slackHandle}
          placeholder="Add a Slack handle"
        />
      </div>
      <div data-row="phone">
        <EditableField
          field="phone"
          label="Phone"
          value={record.phone}
          placeholder="Add a phone number"
        />
      </div>
      <div
        data-row="bio"
        className="min-h-[4.5rem]">
        <EditableField
          field="bio"
          label="Bio"
          value={record.bio}
          placeholder="Add a bio"
          multiline
        />
      </div>
      <div data-row="email">
        <ShownValue
          label="Email"
          value={record.email}
        />
      </div>
      <div data-row="role">
        <ShownValue
          label="Account role"
          value={record.role}
        />
      </div>
      <ChangePasswordLink />
    </div>
  );
}