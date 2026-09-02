import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const APP_ROOT = join(process.cwd(), "src", "app");
const PROFILE_ROUTE_DIR = join(APP_ROOT, "(app)", "profile");
const PAGE_PATH = join(PROFILE_ROUTE_DIR, "page.tsx");
const PROFILE_FEATURE_ROOT = join(process.cwd(), "src", "features", "profile");

function pageSource(): string {
  return readFileSync(PAGE_PATH, "utf8");
}

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

describe("the /profile route (FR-001, FR-005, FR-031, A-4, A-5, E-4)", () => {
  it("calls requireActor() before it queries the profile record", () => {
    const source = pageSource();
    const pageFunctionIndex = source.indexOf("export default async function ProfilePage");
    expect(pageFunctionIndex).toBeGreaterThan(-1);
    const pageFunctionBody = source.slice(pageFunctionIndex);

    const guardIndex = pageFunctionBody.indexOf("requireActor(");
    const returnIndex = pageFunctionBody.indexOf("return");
    expect(guardIndex).toBeGreaterThan(-1);
    expect(returnIndex).toBeGreaterThan(-1);
    expect(guardIndex).toBeLessThan(returnIndex);

    expect(pageFunctionBody).not.toContain("getOwnProfile(");
    expect(source).toContain("getOwnProfile(");
  });

  it("renders ProfileScreen inside a Suspense boundary whose fallback is ProfileSkeleton", () => {
    const source = pageSource();
    expect(source).toContain('import { requireActor } from "@/features/auth/server/actor"');
    expect(source).toMatch(
      /import\s*{\s*ProfileScreen\s*}\s*from\s*"@\/features\/profile\/components\/profile-screen"/,
    );
    expect(/<Suspense[^>]*fallback={<ProfileSkeleton\s*\/>}>/.test(source)).toBe(true);
    expect(source).toContain("<ProfileScreen");

    const suspenseOpen = source.match(/<Suspense[^>]*fallback={<ProfileSkeleton\s*\/>}>/);
    expect(suspenseOpen).not.toBeNull();
    const match = suspenseOpen?.[0] ?? "";
    const afterSuspenseOpen = source.slice(source.indexOf(match) + match.length);
    const suspenseBody = afterSuspenseOpen.slice(0, afterSuspenseOpen.indexOf("</Suspense>"));
    expect(suspenseBody.trim().length).toBeGreaterThan(0);
    expect(suspenseBody).not.toContain("<ProfileSkeleton");
  });

  it("has no loading.tsx at or above the route", () => {
    expect(existsSync(join(PROFILE_ROUTE_DIR, "loading.tsx"))).toBe(false);
    expect(existsSync(join(APP_ROOT, "(app)", "loading.tsx"))).toBe(false);
    expect(existsSync(join(APP_ROOT, "loading.tsx"))).toBe(false);
  });

  it("guards with R1's requireActor(), which redirects, and stands up no Forbidden path", () => {
    const source = pageSource();
    expect(source).not.toMatch(/forbidden/i);
    expect(source).not.toContain("isAdmin");
    expect(source).not.toContain("isMember");
  });
});

describe("the record is reachable by no route, control or parameter but the caller's own (FR-002, SC-004)", () => {
  it("names no other user's record anywhere under src/app", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) {
          if (/^\[.*user.*\]$/i.test(entry)) {
            offenders.push(path);
          }
          walk(path);
        }
      }
    };
    walk(APP_ROOT);
    expect(offenders).toEqual([]);
  });

  it("has no [userId] segment under the profile route itself", () => {
    expect(existsSync(join(PROFILE_ROUTE_DIR, "[userId]"))).toBe(false);
  });

  it("has exactly one profile route", () => {
    const profileDirs = readdirSync(join(APP_ROOT, "(app)")).filter((entry) => entry === "profile");
    expect(profileDirs).toEqual(["profile"]);
  });

  it("reads no user identifier from a search parameter", () => {
    const source = pageSource();
    expect(source).not.toContain("searchParams");
    expect(source).not.toMatch(/\?user=/);
  });
});

describe("no password control exists on this screen (FR-027, OT-SEC-004)", () => {
  it("no file under src/features/profile carries a password field", () => {
    const offenders = collectFiles(PROFILE_FEATURE_ROOT).filter((path) =>
      /type=["']password["']/.test(readFileSync(path, "utf8")),
    );
    expect(offenders).toEqual([]);
  });

  it("the route file carries no password field", () => {
    expect(pageSource()).not.toMatch(/type=["']password["']/);
  });
});

describe("this entry consumes, and does not duplicate, R3's app-wide singletons (FR-033, FR-034, E-3)", () => {
  it("no file under src/features/profile stands up a message host or a connection banner", () => {
    const offenders = collectFiles(PROFILE_FEATURE_ROOT).filter((path) => {
      const source = readFileSync(path, "utf8");
      return source.includes("<MessageHost") || source.includes("<ConnectionBanner");
    });
    expect(offenders).toEqual([]);
  });

  it("the route file stands up neither", () => {
    const source = pageSource();
    expect(source).not.toContain("<MessageHost");
    expect(source).not.toContain("<ConnectionBanner");
  });
});