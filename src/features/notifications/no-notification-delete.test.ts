import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..", "..");

const SCANNED_DIRECTORIES = [
  join(REPO_ROOT, "src", "features", "notifications"),
  join(REPO_ROOT, "src", "features", "activity", "server"),
  join(REPO_ROOT, "src", "features", "issues", "server"),
  join(REPO_ROOT, "src", "features", "projects", "server"),
];

const DELETE_CALL_PATTERN = /delete\s*\(\s*notification\s*[,)]/;

function sourceFilesUnder(directory: string): string[] {
  return readdirSync(directory, { recursive: true })
    .map((entry) => String(entry))
    .filter((entry) => entry.endsWith(".ts") || entry.endsWith(".tsx"))
    .map((entry) => join(directory, entry))
    .filter((file) => file !== __filename);
}

describe("a notification row leaves the table only by cascade (FR-032)", () => {
  for (const directory of SCANNED_DIRECTORIES) {
    it(`${relative(REPO_ROOT, directory)} deletes no notification row`, () => {
      const offenders = sourceFilesUnder(directory)
        .filter((file) => DELETE_CALL_PATTERN.test(readFileSync(file, "utf8")))
        .map((file) => relative(REPO_ROOT, file));

      expect(offenders).toEqual([]);
    });
  }

  it("recognises a delete call when one is written", () => {
    expect(DELETE_CALL_PATTERN.test("await tx.delete(notification).where(eq(notification.id, id))")).toBe(
      true,
    );
  });
});