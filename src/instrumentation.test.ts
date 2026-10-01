import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { register } from "./instrumentation.ts";

const otherValue = "postgres://secret-user:secret-pass@localhost:5432/other_db";

describe("register", () => {
  let exit: ReturnType<typeof vi.spyOn>;
  let stderr: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("TEST_DATABASE_URL", otherValue);
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

  it("does not exit with valid settings", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://user:pass@localhost:5432/tracklite_dev");

    await register();

    expect(exit).not.toHaveBeenCalled();
    expect(written()).toBe("");
  });
});