import { describe, expect, it } from "vitest";
import { assertPasswordPolicy } from "./password-policy";

describe("assertPasswordPolicy (FR-026, FR-027)", () => {
  it("fails too_short at eleven characters", () => {
    expect(assertPasswordPolicy("a".repeat(11))).toBe("too_short");
  });

  it("passes at exactly twelve characters", () => {
    expect(assertPasswordPolicy("a-long-enoug")).toBeNull();
  });

  it("fails too_long at 129 characters", () => {
    expect(assertPasswordPolicy("a".repeat(129))).toBe("too_long");
  });

  it("passes at exactly 128 characters", () => {
    expect(assertPasswordPolicy("a".repeat(128))).toBeNull();
  });

  it("fails blocklisted for a common password, whatever its case", () => {
    expect(assertPasswordPolicy("unbelievable")).toBe("blocklisted");
    expect(assertPasswordPolicy("UnBelievable")).toBe("blocklisted");
  });

  it("applies no composition rule — an all-lowercase compliant password passes", () => {
    expect(assertPasswordPolicy("correct horse battery")).toBeNull();
  });
});