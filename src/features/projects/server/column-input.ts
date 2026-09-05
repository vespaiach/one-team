import "server-only";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PROJECT_KEY_PATTERN = /^[A-Z][A-Z0-9]{0,7}$/;

export function parseColumnId(value: unknown): string | null {
  return typeof value === "string" && UUID_PATTERN.test(value) ? value : null;
}

export function parseProjectKey(value: unknown): string | null {
  return typeof value === "string" && PROJECT_KEY_PATTERN.test(value) ? value : null;
}

export function parsePlacement(value: unknown): "before" | "after" | null {
  if (value === "before" || value === "after") {
    return value;
  }
  return null;
}