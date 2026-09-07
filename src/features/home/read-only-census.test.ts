import { readdirSync, readFileSync } from "node:fs";
import { relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const FEATURE_DIRECTORY = fileURLToPath(new URL("./", import.meta.url));

const FORBIDDEN_IMPORTS = [
  "markNotificationRead",
  "markAllNotificationsRead",
  "isMember",
  "listFeed",
  "collapseFeed",
  "filterFeedRows",
  "getFeedFilter",
  "setFeedFilter",
  "MENTION_TOKEN_PATTERN",
  "mention-resolve",
  "mention-queries",
  "components/shared/markdown",
];

const FORBIDDEN_RUNTIME = [
  "setInterval",
  "setTimeout",
  "EventSource",
  "WebSocket",
  "revalidatePath",
  "revalidateTag",
  ".refresh()",
  '"use cache"',
  "unstable_cache",
  '"use client"',
  '"use server"',
];

const COLUMN_KIND_LITERALS = /'done'|'canceled'/g;

function sourceFiles(): string[] {
  return readdirSync(FEATURE_DIRECTORY, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name) && !entry.name.includes(".test."))
    .map((entry) => `${entry.parentPath}/${entry.name}`);
}

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function filesContaining(needle: string): string[] {
  return sourceFiles()
    .filter((path) => read(path).includes(needle))
    .map((path) => relative(FEATURE_DIRECTORY, path));
}

function filesMatching(pattern: RegExp): string[] {
  return sourceFiles()
    .filter((path) => pattern.test(read(path)))
    .map((path) => relative(FEATURE_DIRECTORY, path));
}

describe("src/features/home/ has no client runtime and no server entry point (FR-004, A-1, SC-009)", () => {
  it("finds the feature's production files to census", () => {
    expect(sourceFiles().length).toBeGreaterThan(10);
  });

  it("contains no actions.ts anywhere in the feature", () => {
    expect(sourceFiles().filter((path) => path.endsWith("actions.ts"))).toEqual([]);
  });
});

describe("src/features/home/ imports nothing that could write, mark read or filter a feed (FR-022, FR-026, FR-032, FR-043, C-5, D-6)", () => {
  for (const forbidden of FORBIDDEN_IMPORTS) {
    it(`names ${forbidden} in no file`, () => {
      expect(filesContaining(forbidden)).toEqual([]);
    });
  }

  it("reads no user.feed_filter", () => {
    expect(filesMatching(/feedFilter|feed_filter/)).toEqual([]);
  });
});

describe("src/features/home/ polls nothing, caches nothing across requests and revalidates nothing (FR-004, FR-039, FR-041, A-1, D-3)", () => {
  for (const forbidden of FORBIDDEN_RUNTIME) {
    it(`contains no ${forbidden}`, () => {
      expect(filesContaining(forbidden)).toEqual([]);
    });
  }

  it("registers no focus, visibility or effect-driven listener", () => {
    expect(filesMatching(/addEventListener|onFocus|visibilitychange|useEffect/)).toEqual([]);
  });
});

describe("src/features/home/ reads the done and canceled column kinds and guards nothing with them (FR-020, OT-INV-014)", () => {
  it("names the two kinds in the progress aggregate alone", () => {
    expect(filesMatching(/'done'|'canceled'/)).toEqual(["server/project-queries.ts"]);
  });

  it("names them only inside the two counting aggregates, never in a guard", () => {
    const source = read(`${FEATURE_DIRECTORY}server/project-queries.ts`);

    expect(source).toMatch(/count\(\*\) filter \(where \$\{boardColumn\.kind\} = 'done'\)/);
    expect(source).toMatch(/count\(\*\) filter \(where \$\{boardColumn\.kind\} <> 'canceled'\)/);
    expect(source.match(COLUMN_KIND_LITERALS)).toHaveLength(2);
    expect(source).not.toMatch(/throw|invariant|OT-INV-014/);
  });
});