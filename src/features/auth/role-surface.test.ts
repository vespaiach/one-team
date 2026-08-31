import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROLE_ASSIGNMENT = /\brole\s*:/;

function collectFiles(root: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      files.push(...collectFiles(path));
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".test.ts") && !entry.endsWith(".test.tsx")) {
      files.push(path);
    }
  }
  return files;
}

describe("role change surface (FR-055, OT-AUTHZ-011)", () => {
  it("no file under src/app sets user.role", () => {
    const offenders = collectFiles(join(process.cwd(), "src", "app")).filter((path) =>
      ROLE_ASSIGNMENT.test(readFileSync(path, "utf8")),
    );
    expect(offenders).toEqual([]);
  });

  it("the Server Action module does not set user.role", () => {
    const path = join(process.cwd(), "src", "features", "auth", "actions.ts");
    expect(ROLE_ASSIGNMENT.test(readFileSync(path, "utf8"))).toBe(false);
  });
});