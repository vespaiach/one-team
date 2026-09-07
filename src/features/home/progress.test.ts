import { describe, expect, it } from "vitest";
import { progressPercent } from "./progress";

describe("progressPercent (FR-017, FR-018, FR-019)", () => {
  it("rounds to the nearest whole number with halves up, so three of eight reads 38", () => {
    expect(progressPercent(3, 8)).toBe(38);
  });

  it("reads 0 when the denominator is zero rather than blank, a dash or an error", () => {
    expect(progressPercent(0, 0)).toBe(0);
  });

  it("applies no clamp at the bottom", () => {
    expect(progressPercent(0, 5)).toBe(0);
  });

  it("reads 99 while one counted issue is open, and 100 only when none is", () => {
    expect(progressPercent(199, 200)).toBe(99);
    expect(progressPercent(200, 200)).toBe(100);
  });
});