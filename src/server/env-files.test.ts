import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function checkIgnoreStatus(path: string): number | null {
  return spawnSync("git", ["check-ignore", "--quiet", path], {
    stdio: "ignore",
  }).status;
}

describe("settings files", () => {
  it("git-ignores .env.local", () => {
    expect(checkIgnoreStatus(".env.local")).toBe(0);
  });

  it("does not git-ignore .env.example", () => {
    expect(checkIgnoreStatus(".env.example")).toBe(1);
  });

  it("OPS-006.1 a configured RESEND_API_KEY never appears in the repository", () => {
    const key = process.env.RESEND_API_KEY;
    if (key) {
      const status = spawnSync("git", ["grep", "--quiet", "--fixed-strings", key], {
        stdio: "ignore",
      }).status;
      expect(status).toBe(1);
    }
    const line = readFileSync(".env.example", "utf8")
      .split("\n")
      .find((entry) => entry.startsWith("RESEND_API_KEY="));
    expect(line).toBeDefined();
    expect(line?.slice("RESEND_API_KEY=".length).trim()).toMatch(/^([A-Z_]*|<[^>]*>)$/);
  });
});