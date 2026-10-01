import { afterEach, describe, expect, it, vi } from "vitest";
import { readSettings } from "./config.ts";

const otherValue = "postgres://secret-user:secret-pass@localhost:5432/other_db";

function messageOf(action: () => unknown): string {
  try {
    action();
  } catch (error) {
    return (error as Error).message;
  }
  throw new Error("Expected an error");
}

describe("readSettings", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns a set setting", () => {
    vi.stubEnv("DATABASE_URL", "postgres://user:pass@localhost:5432/tracklite_dev");

    expect(readSettings()).toEqual({
      databaseUrl: "postgres://user:pass@localhost:5432/tracklite_dev",
    });
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
  ])("throws when DATABASE_URL is %s without echoing other values", (_, value) => {
    vi.stubEnv("DATABASE_URL", value);
    vi.stubEnv("TEST_DATABASE_URL", otherValue);

    const message = messageOf(readSettings);

    expect(message).toBe("Missing setting: DATABASE_URL");
    expect(message).not.toContain(otherValue);
    expect(message).not.toContain("secret");
  });
});