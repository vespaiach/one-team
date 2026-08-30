import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const bootstrapMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@/features/auth/server/bootstrap", () => ({
  bootstrap: bootstrapMock,
}));

describe("instrumentation register() (research B-4)", () => {
  const originalRuntime = process.env.NEXT_RUNTIME;

  beforeEach(() => {
    vi.resetModules();
    bootstrapMock.mockClear();
  });

  afterEach(() => {
    process.env.NEXT_RUNTIME = originalRuntime;
  });

  it("does nothing outside the nodejs runtime", async () => {
    process.env.NEXT_RUNTIME = "edge";
    const { register } = await import("./instrumentation");

    await register();

    expect(bootstrapMock).not.toHaveBeenCalled();
  });

  it("runs bootstrap once under the nodejs runtime", async () => {
    process.env.NEXT_RUNTIME = "nodejs";
    const { register } = await import("./instrumentation");

    await register();

    expect(bootstrapMock).toHaveBeenCalledTimes(1);
  });

  it("a second call in one process is a no-op", async () => {
    process.env.NEXT_RUNTIME = "nodejs";
    const { register } = await import("./instrumentation");

    await register();
    await register();

    expect(bootstrapMock).toHaveBeenCalledTimes(1);
  });
});