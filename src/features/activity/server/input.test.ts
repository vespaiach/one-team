import { describe, expect, it } from "vitest";
import { parseCommentBody } from "./input";

describe("parseCommentBody (FR-040, FR-041)", () => {
  it("trims surrounding whitespace", () => {
    expect(parseCommentBody("  Looks good.  ")).toBe("Looks good.");
  });

  it("refuses an empty body", () => {
    expect(parseCommentBody("")).toBeNull();
  });

  it("refuses a whitespace-only body", () => {
    expect(parseCommentBody("   ")).toBeNull();
  });

  it("accepts a body at exactly 10000 characters after trim", () => {
    expect(parseCommentBody("a".repeat(10000))).toBe("a".repeat(10000));
  });

  it("refuses a body over 10000 characters after trim, without truncating it", () => {
    expect(parseCommentBody("a".repeat(10001))).toBeNull();
  });

  it("measures the 10000-character bound after trimming, not before", () => {
    const padded = ` ${"a".repeat(10000)} `;
    expect(parseCommentBody(padded)).toBe("a".repeat(10000));
  });

  it("refuses a non-string value", () => {
    expect(parseCommentBody(undefined)).toBeNull();
    expect(parseCommentBody(42)).toBeNull();
  });
});