import "server-only";

export type ProfileInputRefusalReason = "required" | "too_long" | "avatar_scheme";

export type ParsedProfileValue<T> = { ok: true; value: T } | { ok: false; reason: ProfileInputRefusalReason };

function codePointLength(value: string): number {
  return [...value].length;
}

function isAllowedAvatarUrl(value: string): boolean {
  if (!URL.canParse(value)) {
    return false;
  }
  const { protocol } = new URL(value);
  return protocol === "http:" || protocol === "https:";
}

export function parseRequiredField(value: unknown, bound: number): ParsedProfileValue<string> {
  if (typeof value !== "string") {
    return { ok: false, reason: "required" };
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { ok: false, reason: "required" };
  }
  if (codePointLength(trimmed) > bound) {
    return { ok: false, reason: "too_long" };
  }
  return { ok: true, value: trimmed };
}

export function parseOptionalField(value: unknown, bound: number): ParsedProfileValue<string | null> {
  if (typeof value !== "string") {
    return { ok: false, reason: "required" };
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { ok: true, value: null };
  }
  if (codePointLength(trimmed) > bound) {
    return { ok: false, reason: "too_long" };
  }
  return { ok: true, value: trimmed };
}

export function parseAvatarField(value: unknown, bound: number): ParsedProfileValue<string | null> {
  if (typeof value !== "string") {
    return { ok: false, reason: "required" };
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { ok: true, value: null };
  }
  if (codePointLength(trimmed) > bound) {
    return { ok: false, reason: "too_long" };
  }
  if (!isAllowedAvatarUrl(trimmed)) {
    return { ok: false, reason: "avatar_scheme" };
  }
  return { ok: true, value: trimmed };
}