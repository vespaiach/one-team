import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { register } from "./instrumentation.ts";

const otherValue = "postgres://secret-user:secret-pass@localhost:5432/other_db";

describe("register", () => {
  let exit: ReturnType<typeof vi.spyOn>;
  let stderr: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("TEST_DATABASE_URL", otherValue);
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APP_URL", "http://localhost:3000");
    vi.stubEnv("EMAIL_FROM", "tracklite@localhost");
    vi.stubEnv("MAILPIT_HOST", "localhost");
    vi.stubEnv("MAILPIT_PORT", "8025");
    exit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  function written(): string {
    return stderr.mock.calls.map((call: unknown[]) => String(call[0])).join("");
  }

  it.each([
    ["missing", undefined],
    ["empty", ""],
  ])("exits with code 1 when DATABASE_URL is %s", async (_, value) => {
    vi.stubEnv("DATABASE_URL", value);

    await register();

    expect(exit).toHaveBeenCalledWith(1);
    expect(written()).toContain("Missing setting: DATABASE_URL");
    expect(written()).not.toContain(otherValue);
    expect(written()).not.toContain("secret");
  });

  it("exits with code 1 when MAILPIT_HOST is missing in local development", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://user:pass@localhost:5432/tracklite_dev");
    vi.stubEnv("MAILPIT_HOST", undefined);

    await register();

    expect(exit).toHaveBeenCalledWith(1);
    expect(written()).toContain("Missing setting: MAILPIT_HOST");
  });

  it("exits with code 1 when MAILPIT_PORT is out of range", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://user:pass@localhost:5432/tracklite_dev");
    vi.stubEnv("MAILPIT_PORT", "70000");

    await register();

    expect(exit).toHaveBeenCalledWith(1);
    expect(written()).toContain("Invalid setting: MAILPIT_PORT");
    expect(written()).not.toContain("70000");
  });

  it("does not exit with valid settings", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://user:pass@localhost:5432/tracklite_dev");

    await register();

    expect(exit).not.toHaveBeenCalled();
    expect(written()).toBe("");
  });
});