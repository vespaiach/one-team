import "server-only";

const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 10000;
const PRIORITIES = ["none", "low", "medium", "high", "urgent"] as const;
const DUE_DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/;

export type IssuePriority = (typeof PRIORITIES)[number];

export function parseTitle(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > MAX_TITLE_LENGTH) {
    return null;
  }
  return trimmed;
}

export function parseDescription(value: unknown): string | null {
  if (typeof value !== "string" || value.length > MAX_DESCRIPTION_LENGTH) {
    return null;
  }
  return value;
}

export function parsePriority(value: unknown): IssuePriority | null {
  if (typeof value !== "string") {
    return null;
  }
  return (PRIORITIES as readonly string[]).includes(value) ? (value as IssuePriority) : null;
}

export function parseDueDate(value: unknown): string | null {
  if (typeof value !== "string" || !DUE_DATE_SHAPE.test(value)) {
    return null;
  }
  const [yearPart, monthPart, dayPart] = value.split("-");
  const year = Number(yearPart);
  const month = Number(monthPart);
  const day = Number(dayPart);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  const isRealDay =
    parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
  return isRealDay ? value : null;
}