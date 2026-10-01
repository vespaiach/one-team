import { describe, expect, it } from "vitest";
import { formatTime } from "./time.ts";

describe("formatTime", () => {
  it("shows the time in the given zone", () => {
    expect(formatTime("2026-09-30T02:00:00Z", "Asia/Bangkok")).toBe("09:00");
  });

  it("uses 24-hour HH:mm with no zone label", () => {
    expect(formatTime("2026-09-30T15:00:00Z", "UTC")).toBe("15:00");
    expect(formatTime("2026-09-30T00:05:00Z", "UTC")).toBe("00:05");
  });

  it("falls back to UTC for an invalid zone", () => {
    expect(formatTime("2026-09-30T15:00:00Z", "Not/AZone")).toBe("15:00");
  });
});