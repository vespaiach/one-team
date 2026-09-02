export const TOKEN_SHAPE = /^[A-Za-z0-9_-]{20,}$/;

export type TokenState = "valid" | "used" | "expired";

export function classifyToken(
  fields: { spentAt: Date | null; expiresAt: Date },
  now: Date = new Date(),
): TokenState {
  if (fields.spentAt !== null) {
    return "used";
  }
  if (fields.expiresAt <= now) {
    return "expired";
  }
  return "valid";
}