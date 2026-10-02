import { spawnSync } from "node:child_process";
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

  it("commits no settings file other than .env.example", () => {
    const committed = spawnSync("git", ["ls-files"], { encoding: "utf8" })
      .stdout.split("\n")
      .filter((path) => {
        const name = path.split("/").pop() ?? "";
        return name === ".env" || name.startsWith(".env.") || name.endsWith(".env");
      });
    expect(committed).toEqual([".env.example"]);
  });
});