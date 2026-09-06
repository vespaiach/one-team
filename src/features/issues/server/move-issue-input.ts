import "server-only";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type BoardGrouping = "column" | "assignee" | "priority";

export function parseGrouping(value: unknown): BoardGrouping | null {
  if (value === "column" || value === "assignee" || value === "priority") {
    return value;
  }
  return null;
}

export function parseIssueId(value: unknown): string | null {
  return typeof value === "string" && UUID_PATTERN.test(value) ? value : null;
}