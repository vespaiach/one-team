import "server-only";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export type PasswordPolicyFailure = "too_short" | "too_long" | "blocklisted";

const BLOCKLIST_PATH = fileURLToPath(new URL("./common-passwords.txt", import.meta.url));

const BLOCKLIST = new Set(
  readFileSync(BLOCKLIST_PATH, "utf8")
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => line.toLowerCase()),
);

export function assertPasswordPolicy(password: string): PasswordPolicyFailure | null {
  if (password.length < 12) {
    return "too_short";
  }
  if (password.length > 128) {
    return "too_long";
  }
  if (BLOCKLIST.has(password.toLowerCase())) {
    return "blocklisted";
  }
  return null;
}