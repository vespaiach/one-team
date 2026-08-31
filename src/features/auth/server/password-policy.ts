import "server-only";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type PasswordPolicyFailure = "too_short" | "too_long" | "blocklisted";

const BLOCKLIST_PATH = join(dirname(fileURLToPath(import.meta.url)), "common-passwords.txt");

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