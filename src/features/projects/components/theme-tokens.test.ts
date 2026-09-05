import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const COMPONENTS_DIR = join(process.cwd(), "src", "features", "projects", "components");
const GLOBALS_CSS = join(process.cwd(), "src", "app", "globals.css");

const PRE_EXISTING_REPO_WIDE_GAPS = new Set(["--color-surface-hover"]);

const TOKEN_DECLARATION = /^\s*(--[a-z0-9-]+)\s*:/gm;
const TOKEN_REFERENCE = /\((--[a-z0-9-]+)\)/g;

const declaredTokens = new Set(
  [...readFileSync(GLOBALS_CSS, "utf8").matchAll(TOKEN_DECLARATION)].map((match) => match[1]),
);

const componentFiles = readdirSync(COMPONENTS_DIR)
  .filter((name) => name.endsWith(".tsx") && !name.endsWith(".test.tsx"))
  .sort();

function unresolvableTokensIn(file: string) {
  const source = readFileSync(join(COMPONENTS_DIR, file), "utf8");
  return source.split("\n").flatMap((line, index) =>
    [...line.matchAll(TOKEN_REFERENCE)]
      .map((match) => match[1])
      .filter((token) => !declaredTokens.has(token) && !PRE_EXISTING_REPO_WIDE_GAPS.has(token))
      .map((token) => `${file}:${index + 1} ${token}`),
  );
}

describe("every colour token a project component styles with resolves against globals.css (FR-018)", () => {
  it("finds the theme declarations to check against", () => {
    expect(declaredTokens.has("--color-accent")).toBe(true);
    expect(declaredTokens.has("--color-danger-text")).toBe(true);
    expect(componentFiles.length).toBeGreaterThan(0);
  });

  for (const file of componentFiles) {
    it(`${file} names no undeclared custom property`, () => {
      expect(unresolvableTokensIn(file)).toEqual([]);
    });
  }
});