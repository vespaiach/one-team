import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = process.cwd();
const GLOBALS_CSS = join(REPO_ROOT, "src", "app", "globals.css");
const FEATURES_DIR = join(REPO_ROOT, "src", "features");

const PRE_EXISTING_REPO_WIDE_GAPS = new Set(["--font-mono-ui", "--font-source-serif"]);

const TOKEN_DECLARATION = /^\s*(--[a-z0-9-]+)\s*:/gm;
const TOKEN_REFERENCE = /\((--[a-z0-9-]+)\)/g;

const declaredTokens = new Set(
  [...readFileSync(GLOBALS_CSS, "utf8").matchAll(TOKEN_DECLARATION)].map((match) => match[1]),
);

function componentFilesUnder(dir: string): string[] {
  return readdirSync(dir, { recursive: true })
    .map((name) => name.toString())
    .filter((name) => name.endsWith(".tsx") && !name.endsWith(".test.tsx"))
    .map((name) => join(dir, name))
    .sort();
}

const featureComponentDirs = readdirSync(FEATURES_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => join(FEATURES_DIR, entry.name, "components"));

const componentFiles = [
  ...featureComponentDirs.flatMap(componentFilesUnder),
  ...componentFilesUnder(join(REPO_ROOT, "src", "app")),
  ...componentFilesUnder(join(REPO_ROOT, "src", "components", "shared")),
].sort();

function unresolvableTokensIn(file: string) {
  const source = readFileSync(file, "utf8");
  return source.split("\n").flatMap((line, index) =>
    [...line.matchAll(TOKEN_REFERENCE)]
      .map((match) => match[1])
      .filter((token) => !declaredTokens.has(token) && !PRE_EXISTING_REPO_WIDE_GAPS.has(token))
      .map((token) => `${file.slice(REPO_ROOT.length + 1)}:${index + 1} ${token}`),
  );
}

describe("every colour token a component styles with resolves against globals.css (FR-018)", () => {
  it("finds the theme declarations to check against", () => {
    expect(declaredTokens.has("--color-accent")).toBe(true);
    expect(declaredTokens.has("--color-danger-text")).toBe(true);
    expect(componentFiles.length).toBeGreaterThan(0);
  });

  for (const file of componentFiles) {
    it(`${file.slice(REPO_ROOT.length + 1)} names no undeclared custom property`, () => {
      expect(unresolvableTokensIn(file)).toEqual([]);
    });
  }
});