import "server-only";

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 200;
const MAX_PASSWORD_LENGTH = 128;

export function parseEmail(value: unknown): string | null {
  if (typeof value !== "string" || value.length > MAX_EMAIL_LENGTH) {
    return null;
  }
  if (!EMAIL_SHAPE.test(value)) {
    return null;
  }
  return value.toLowerCase();
}

export function parsePassword(value: unknown): string | null {
  if (typeof value !== "string" || value.length > MAX_PASSWORD_LENGTH) {
    return null;
  }
  return value;
}