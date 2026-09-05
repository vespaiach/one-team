const MAX_NAME_LENGTH = 200;

export type ParsedColumnName = { ok: true; name: string } | { ok: false; reason: "required" | "too_long" };

export function parseColumnName(value: unknown): ParsedColumnName {
  if (typeof value !== "string") {
    return { ok: false, reason: "required" };
  }
  const name = value.trim();
  if (name === "") {
    return { ok: false, reason: "required" };
  }
  if (name.length > MAX_NAME_LENGTH) {
    return { ok: false, reason: "too_long" };
  }
  return { ok: true, name };
}