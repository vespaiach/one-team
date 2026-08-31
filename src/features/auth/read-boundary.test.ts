import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SRC_ROOT = join(__dirname, "..", "..");
const SERVER_DIR = join(__dirname, "server");

const RESTRICTED_IDENTIFIERS = ["credential", "session", "resetToken", "authAttempt"];
const PROJECTION_IDENTIFIERS = ["publicUser", "accountUser"];

function isSourceFile(path: string): boolean {
  return (
    (path.endsWith(".ts") || path.endsWith(".tsx")) &&
    !path.endsWith(".test.ts") &&
    !path.endsWith(".test.tsx")
  );
}

function listSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...listSourceFiles(full));
    } else if (isSourceFile(full)) {
      files.push(full);
    }
  }
  return files;
}

function importedIdentifiersFrom(source: string, moduleSuffix: string): string[] {
  const importRegex = /import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+["']([^"']+)["']/g;
  const found: string[] = [];
  for (const match of source.matchAll(importRegex)) {
    const [, clause, specifier] = match;
    if (!specifier || !clause) continue;
    if (specifier === "@/db/schema" || specifier.endsWith(moduleSuffix)) {
      for (const part of clause.split(",")) {
        const name = part
          .trim()
          .split(/\s+as\s+/)[0]
          ?.trim();
        if (name) found.push(name);
      }
    }
  }
  return found;
}

describe("read boundary (FR-005, FR-015)", () => {
  const allFiles = listSourceFiles(SRC_ROOT).filter((f) => f !== join(SRC_ROOT, "db", "schema.ts"));
  const outsideServer = allFiles.filter((f) => !f.startsWith(SERVER_DIR));

  it("names every file scanned, for visibility when the assertions below fail", () => {
    expect(outsideServer.length).toBeGreaterThan(0);
  });

  it("has no query outside src/features/auth/server/ naming credential, session, reset_token or auth_attempt", () => {
    const offenders: string[] = [];
    for (const file of outsideServer) {
      const source = readFileSync(file, "utf8");
      const identifiers = importedIdentifiersFrom(source, "db/schema");
      const hit = identifiers.find((id) => RESTRICTED_IDENTIFIERS.includes(id));
      if (hit) {
        offenders.push(`${relative(SRC_ROOT, file)} imports "${hit}" from the schema`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("has no unauthenticated route selecting publicUser or accountUser", () => {
    const appDir = join(SRC_ROOT, "app");
    const offenders: string[] = [];
    for (const file of listSourceFiles(appDir)) {
      const source = readFileSync(file, "utf8");
      const identifiers = importedIdentifiersFrom(source, "projections");
      const hit = identifiers.find((id) => PROJECTION_IDENTIFIERS.includes(id));
      if (hit) {
        offenders.push(`${relative(SRC_ROOT, file)} imports "${hit}"`);
      }
    }
    expect(offenders).toEqual([]);
  });
});