import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..", "..");

const SCANNED_FILES = [
  join(REPO_ROOT, "src", "features", "activity", "components", "feed.tsx"),
  join(REPO_ROOT, "src", "app", "(app)", "projects", "[projectKey]", "details", "page.tsx"),
  join(
    REPO_ROOT,
    "src",
    "app",
    "(app)",
    "projects",
    "[projectKey]",
    "issues",
    "[issueNumber]",
    "details",
    "page.tsx",
  ),
];

const POLLING_PATTERNS = ["setInterval", "setTimeout", "requestAnimationFrame", "poll"];

describe("the feed re-queries only on navigation, never on a timer (FR-036, OT-UX-006)", () => {
  for (const file of SCANNED_FILES) {
    it(`${join("src", relativeFromRepoRoot(file, REPO_ROOT))} issues no polling call`, () => {
      const source = readFileSync(file, "utf8");
      const lowered = source.toLowerCase();
      const offenders = POLLING_PATTERNS.filter((pattern) => lowered.includes(pattern.toLowerCase()));
      expect(offenders).toEqual([]);
    });
  }
});

function relativeFromRepoRoot(file: string, root: string): string {
  return file.slice(root.length + 1);
}