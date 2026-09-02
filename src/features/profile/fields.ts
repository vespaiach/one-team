export type ProfileField =
  | "avatarUrl"
  | "firstName"
  | "lastName"
  | "jobTitle"
  | "slackHandle"
  | "phone"
  | "bio";

export type ProfileFieldDefinition = {
  field: ProfileField;
  label: string;
  bound: number;
};

export const PROFILE_FIELDS: readonly ProfileFieldDefinition[] = [
  { field: "avatarUrl", label: "Avatar", bound: 2000 },
  { field: "firstName", label: "First name", bound: 200 },
  { field: "lastName", label: "Last name", bound: 200 },
  { field: "jobTitle", label: "Job title", bound: 200 },
  { field: "slackHandle", label: "Slack handle", bound: 200 },
  { field: "phone", label: "Phone", bound: 200 },
  { field: "bio", label: "Bio", bound: 10000 },
];