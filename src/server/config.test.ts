import { afterEach, describe, expect, it, vi } from "vitest";
import { readAppSettings, readSettings } from "./config.ts";

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

  it("needs only DATABASE_URL", () => {
    vi.stubEnv("DATABASE_URL", "postgres://user:pass@localhost:5432/tracklite_dev");
    for (const name of ["APP_URL", "EMAIL_FROM", "RESEND_API_KEY", "MAILPIT_HOST", "MAILPIT_PORT"]) {
      vi.stubEnv(name, undefined);
    }

    expect(readSettings()).toEqual({
      databaseUrl: "postgres://user:pass@localhost:5432/tracklite_dev",
    });
  });
});

describe("readAppSettings", () => {
  const apiKey = "re_secret_api_key_value";

  function useLocalSettings() {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APP_URL", "http://localhost:3000");
    vi.stubEnv("EMAIL_FROM", "tracklite@localhost");
    vi.stubEnv("MAILPIT_HOST", "mailpit.internal");
    vi.stubEnv("MAILPIT_PORT", "8025");
    vi.stubEnv("RESEND_API_KEY", undefined);
  }

  function useProductionSettings() {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_URL", "https://tracklite.example.com");
    vi.stubEnv("EMAIL_FROM", "tracklite@example.com");
    vi.stubEnv("RESEND_API_KEY", apiKey);
    vi.stubEnv("MAILPIT_HOST", undefined);
    vi.stubEnv("MAILPIT_PORT", undefined);
  }

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the Mailpit settings in local development", () => {
    useLocalSettings();

    expect(readAppSettings()).toEqual({
      appUrl: "http://localhost:3000",
      emailFrom: "tracklite@localhost",
      email: { kind: "mailpit", host: "mailpit.internal", port: 8025 },
    });
  });

  it("returns the Resend settings in production", () => {
    useProductionSettings();

    expect(readAppSettings()).toEqual({
      appUrl: "https://tracklite.example.com",
      emailFrom: "tracklite@example.com",
      email: { kind: "resend", apiKey },
    });
  });

  it.each([
    ["APP_URL", undefined],
    ["APP_URL", ""],
    ["EMAIL_FROM", undefined],
    ["EMAIL_FROM", ""],
    ["MAILPIT_HOST", undefined],
    ["MAILPIT_HOST", ""],
    ["MAILPIT_PORT", undefined],
    ["MAILPIT_PORT", ""],
  ])("throws Missing setting: %s locally when it is %j", (name, value) => {
    useLocalSettings();
    vi.stubEnv(name, value);

    expect(messageOf(readAppSettings)).toBe(`Missing setting: ${name}`);
  });

  it.each([
    ["APP_URL", undefined],
    ["APP_URL", ""],
    ["EMAIL_FROM", undefined],
    ["EMAIL_FROM", ""],
    ["RESEND_API_KEY", undefined],
    ["RESEND_API_KEY", ""],
  ])("throws Missing setting: %s in production when it is %j", (name, value) => {
    useProductionSettings();
    vi.stubEnv(name, value);

    expect(messageOf(readAppSettings)).toBe(`Missing setting: ${name}`);
  });

  it("passes in production without the Mailpit settings", () => {
    useProductionSettings();

    expect(readAppSettings().email).toEqual({ kind: "resend", apiKey });
  });

  it("passes locally without RESEND_API_KEY", () => {
    useLocalSettings();

    expect(readAppSettings().email.kind).toBe("mailpit");
  });

  it.each([
    ["APP_URL", "localhost:3000"],
    ["APP_URL", "ftp://x.com"],
    ["APP_URL", "http://localhost:3000/app"],
    ["APP_URL", "http://localhost:3000/"],
    ["MAILPIT_PORT", "abc"],
    ["MAILPIT_PORT", "0"],
    ["MAILPIT_PORT", "70000"],
    ["MAILPIT_PORT", "80.5"],
    ["EMAIL_FROM", "tracklite"],
  ])("throws Invalid setting: %s for %j without echoing the value", (name, value) => {
    useLocalSettings();
    vi.stubEnv(name, value);

    const message = messageOf(readAppSettings);

    expect(message).toBe(`Invalid setting: ${name}`);
    expect(message).not.toContain(value);
  });

  it("never puts a setting's value in a message", () => {
    useProductionSettings();
    vi.stubEnv("APP_URL", `https://tracklite.example.com/${apiKey}`);

    const message = messageOf(readAppSettings);

    expect(message).toBe("Invalid setting: APP_URL");
    expect(message).not.toContain(apiKey);
    expect(message).not.toContain("tracklite.example.com");
  });
});