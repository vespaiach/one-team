export const ALL_TABLES = [
  "auth_attempt",
  "reset_token",
  "session",
  "credential",
  "invite",
  "comment",
  "activity",
  "issue",
  "issue_label",
  "label",
  "issue_counter",
  "board_column",
  "project_member",
  "project",
  "user",
] as const;

export function truncateAllTablesStatement(): string {
  const tables = ALL_TABLES.map((table) => `"${table}"`).join(", ");
  return `TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`;
}