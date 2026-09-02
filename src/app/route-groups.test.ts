import { readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const APP_DIR = join(import.meta.dirname, ".");
const AUTH_DIR = join(APP_DIR, "(auth)");
const SHELL_DIR = join(APP_DIR, "(app)");

async function filesUnder(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries.filter((entry) => entry.isFile()).map((entry) => join(entry.parentPath, entry.name));
}

describe("route-group boundary (FR-004, s7)", () => {
  it("imports nothing from @/features/shell under (auth)", async () => {
    const files = (await filesUnder(AUTH_DIR)).filter(
      (file) => file.endsWith(".ts") || file.endsWith(".tsx"),
    );

    for (const file of files) {
      const contents = readFileSync(file, "utf8");
      expect(contents).not.toMatch(/@\/features\/shell/);
    }
  });

  it("carries exactly one layout under (app), the shell", async () => {
    const files = await filesUnder(SHELL_DIR);
    const layouts = files.filter((file) => /(^|\/)layout\.tsx$/.test(file));

    expect(layouts).toHaveLength(1);
    expect(layouts[0]).toBe(join(SHELL_DIR, "layout.tsx"));
  });

  it("has no loading.tsx anywhere under (app) — the frame has no pending state of its own", async () => {
    const files = await filesUnder(SHELL_DIR);
    const loadingFiles = files.filter((file) => /(^|\/)loading\.tsx$/.test(file));

    expect(loadingFiles).toHaveLength(0);
  });

  it("renders no banner slot under (auth) — a screen outside the shell has nothing to render and nothing to suppress (s5, FR-027)", async () => {
    const files = (await filesUnder(AUTH_DIR)).filter(
      (file) => file.endsWith(".ts") || file.endsWith(".tsx"),
    );

    for (const file of files) {
      const contents = readFileSync(file, "utf8");
      expect(contents).not.toMatch(/MustChangePasswordBanner/);
    }
  });
});