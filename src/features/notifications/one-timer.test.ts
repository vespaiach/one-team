import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const SOURCE_ROOT = join(REPO_ROOT, "src");
const SWEEP_FILE = join(SOURCE_ROOT, "features", "auth", "server", "sweep.ts");
const MAIL_SWEEP_FILE = join(SOURCE_ROOT, "features", "notifications", "server", "mail-sweep.ts");
const SCHEMA_FILE = join(SOURCE_ROOT, "db", "schema.ts");

function listServerSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return listServerSourceFiles(path);
    }
    if (!/\.ts$/.test(entry.name) || /\.test\.ts$/.test(entry.name)) {
      return [];
    }
    return [path];
  });
}

function occurrences(source: string, needle: string): number {
  return source.split(needle).length - 1;
}

describe("the retry sweep runs on the one timer the installation already has (FR-068, Out of Scope)", () => {
  it("finds setInterval exactly once in the server source, inside startSweep", () => {
    const hits = listServerSourceFiles(SOURCE_ROOT)
      .map((file) => ({ file, count: occurrences(readFileSync(file, "utf8"), "setInterval") }))
      .filter((hit) => hit.count > 0);

    expect(hits.map((hit) => relative(REPO_ROOT, hit.file))).toEqual([relative(REPO_ROOT, SWEEP_FILE)]);
    expect(hits[0]?.count).toBe(1);
    expect(readFileSync(SWEEP_FILE, "utf8")).toMatch(/export function startSweep[\s\S]*?setInterval\(/);
  });

  it("hangs the notification retry off the existing sweep rather than a timer of its own", () => {
    const sweepSource = readFileSync(SWEEP_FILE, "utf8");
    const sweepBody = sweepSource.slice(
      sweepSource.indexOf("export async function sweep("),
      sweepSource.indexOf("export function startSweep"),
    );

    expect(sweepBody).toContain("sweepNotificationMail(now)");
    expect(sweepSource).toContain("SWEEP_INTERVAL_MS = 5 * 60 * 1000");
    expect(sweepSource).toContain("timer.unref()");
    expect(sweepSource).toContain('process.once("SIGTERM", onSigterm)');
  });

  it("gives the mail sweep no timer, no scheduler and no polling of its own", () => {
    const mailSweepSource = readFileSync(MAIL_SWEEP_FILE, "utf8");

    for (const forbidden of ["setInterval", "setTimeout", "cron", "queue", "worker", "scheduler"]) {
      expect(mailSweepSource.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });

  it("introduces no queue, job, worker or delivery-log table", () => {
    const declaredTables = Array.from(
      readFileSync(SCHEMA_FILE, "utf8").matchAll(/pgTable\(\s*"([a-z_]+)"/g),
      (match) => match[1],
    );

    expect(declaredTables).not.toHaveLength(0);
    expect(
      declaredTables.filter((name) =>
        ["queue", "job", "worker", "outbox", "delivery", "mail_log"].some((word) =>
          String(name).includes(word),
        ),
      ),
    ).toEqual([]);
  });
});