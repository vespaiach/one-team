import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  logMailSendFailure,
  logRefusedFirstRunSeed,
  logRefusedSignIn,
  logThrottleRefusal,
  logUnhandledServerError,
} from "./log";

let lines: string[] = [];

beforeEach(() => {
  lines = [];
  vi.spyOn(console, "error").mockImplementation((line: string) => {
    lines.push(line);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function parseLine(line: string): { event: string; at: string; subject: string } {
  return JSON.parse(line);
}

describe("auth log (FR-064, SC-010)", () => {
  it("writes exactly the five enumerated events", () => {
    logRefusedSignIn("ada@example.com");
    logThrottleRefusal("203.0.113.4");
    logMailSendFailure("ada@example.com");
    logRefusedFirstRunSeed("ada@example.com");
    logUnhandledServerError("203.0.113.4");

    expect(lines).toHaveLength(5);
    expect(lines.map((line) => parseLine(line).event)).toEqual([
      "refused_sign_in",
      "throttle_refusal",
      "mail_send_failure",
      "refused_first_run_seed",
      "unhandled_server_error",
    ]);
  });

  it("each line carries the event, the instant, and the address or IP concerned", () => {
    logRefusedSignIn("ada@example.com");

    const entry = parseLine(lines[0] ?? "");
    expect(entry.event).toBe("refused_sign_in");
    expect(new Date(entry.at).toString()).not.toBe("Invalid Date");
    expect(entry.subject).toBe("ada@example.com");
  });

  it("a line carries no field beyond event, instant and subject — no password, hash or token has anywhere to go", () => {
    logThrottleRefusal("203.0.113.4");

    const entry = JSON.parse(lines[0] ?? "{}");
    expect(Object.keys(entry).sort()).toEqual(["at", "event", "subject"]);
  });
});