import "server-only";

const MAX_COMMENT_BODY_LENGTH = 10000;

export function parseCommentBody(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > MAX_COMMENT_BODY_LENGTH) {
    return null;
  }
  return trimmed;
}