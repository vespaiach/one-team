import { afterEach, describe, expect, it, vi } from "vitest";
import { writeLogLine } from "./log.ts";

describe("writeLogLine", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes exactly one line, the JSON of the entry followed by a newline", () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const entry = { time: "2026-10-01T12:00:00.000Z", message: "sign-in, member sam" };

    writeLogLine(entry);

    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith(`${JSON.stringify(entry)}\n`);
  });
});