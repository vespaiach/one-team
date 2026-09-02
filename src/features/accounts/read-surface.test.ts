import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ACCOUNTS_DIR = join(process.cwd(), "src", "features", "accounts");
const SRC_DIR = join(process.cwd(), "src");

const PROJECT_TABLE_WRITE = /\.(insert|update|delete)\s*\(\s*(project|projectMember)\b/;
const USER_INSERT = /\.insert\s*\(\s*user\s*\)/;
const WRITE_CALL = /\.(values|set)\s*\(/g;

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

function extractBalancedCallArguments(source: string, openParenIndex: number): string {
  let depth = 0;
  for (let index = openParenIndex; index < source.length; index += 1) {
    if (source[index] === "(") {
      depth += 1;
    } else if (source[index] === ")") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(openParenIndex + 1, index);
      }
    }
  }
  return source.slice(openParenIndex + 1);
}

function writeCallArguments(source: string): string[] {
  const args: string[] = [];
  for (const match of source.matchAll(WRITE_CALL)) {
    const openParenIndex = (match.index ?? 0) + match[0].length - 1;
    args.push(extractBalancedCallArguments(source, openParenIndex));
  }
  return args;
}

describe("accounts read surface (FR-004, FR-015, FR-016, FR-029, FR-035, OT-DATA-006, OT-AUTHZ-011, OT-SCOPE-005)", () => {
  const accountsFiles = listSourceFiles(ACCOUNTS_DIR);

  it("names every file scanned, for visibility when the assertions below fail", () => {
    expect(accountsFiles.length).toBeGreaterThan(0);
  });

  it("no write call under src/features/accounts/ carries tokenDigest, except the invite table's own digest", () => {
    const offenders: string[] = [];
    for (const file of accountsFiles) {
      if (file.endsWith(join("server", "invitations.ts"))) {
        continue;
      }
      for (const args of writeCallArguments(readFileSync(file, "utf8"))) {
        if (/\btokenDigest\s*:/.test(args)) {
          offenders.push(relative(SRC_DIR, file));
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("every write call setting role under src/features/accounts/ sets only the literal 'member'", () => {
    const offenders: string[] = [];
    for (const file of accountsFiles) {
      for (const args of writeCallArguments(readFileSync(file, "utf8"))) {
        const match = args.match(/\brole\s*:\s*("(?:[^"]*)"|[^,}\n]+)/);
        if (match && match[1] !== '"member"') {
          offenders.push(`${relative(SRC_DIR, file)}: role: ${match[1]}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("no write call under src/features/accounts/ touches a project or project_member row", () => {
    const offenders = accountsFiles.filter((file) => PROJECT_TABLE_WRITE.test(readFileSync(file, "utf8")));
    expect(offenders.map((file) => relative(SRC_DIR, file))).toEqual([]);
  });

  it("acceptInvitation is the only path in src/ outside first-run seeding that inserts a user", () => {
    const allowed = new Set([
      join(SRC_DIR, "features", "accounts", "actions.ts"),
      join(SRC_DIR, "features", "auth", "server", "bootstrap.ts"),
    ]);

    const offenders = listSourceFiles(SRC_DIR).filter(
      (file) => USER_INSERT.test(readFileSync(file, "utf8")) && !allowed.has(file),
    );

    expect(offenders.map((file) => relative(SRC_DIR, file))).toEqual([]);
  });
});