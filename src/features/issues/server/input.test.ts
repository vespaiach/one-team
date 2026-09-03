import { describe, expect, it } from "vitest";
import { parseDescription, parseDueDate, parsePriority, parseTitle } from "./input";

describe("parseTitle (FR-030, FR-037)", () => {
  it("trims surrounding whitespace", () => {
    expect(parseTitle("  Fix the header  ")).toBe("Fix the header");
  });

  it("refuses an empty title", () => {
    expect(parseTitle("")).toBeNull();
  });

  it("refuses a whitespace-only title", () => {
    expect(parseTitle("   ")).toBeNull();
  });

  it("accepts a title at exactly 200 characters after trim", () => {
    expect(parseTitle("a".repeat(200))).toBe("a".repeat(200));
  });

  it("refuses a title over 200 characters after trim, without truncating it", () => {
    expect(parseTitle("a".repeat(201))).toBeNull();
  });

  it("measures the 200-character bound after trimming, not before", () => {
    const padded = ` ${"a".repeat(200)} `;
    expect(parseTitle(padded)).toBe("a".repeat(200));
  });

  it("refuses a non-string value", () => {
    expect(parseTitle(undefined)).toBeNull();
    expect(parseTitle(42)).toBeNull();
  });
});

describe("parseDescription (FR-031, FR-037)", () => {
  it("accepts an empty description", () => {
    expect(parseDescription("")).toBe("");
  });

  it("accepts a description at exactly 10000 characters", () => {
    expect(parseDescription("a".repeat(10000))).toBe("a".repeat(10000));
  });

  it("refuses a description over 10000 characters, without truncating it", () => {
    expect(parseDescription("a".repeat(10001))).toBeNull();
  });

  it("refuses a non-string value", () => {
    expect(parseDescription(undefined)).toBeNull();
    expect(parseDescription(42)).toBeNull();
  });
});

describe("parsePriority (FR-004)", () => {
  it.each(["none", "low", "medium", "high", "urgent"])("accepts %s", (value) => {
    expect(parsePriority(value)).toBe(value);
  });

  it("refuses a sixth value outside the five", () => {
    expect(parsePriority("critical")).toBeNull();
  });

  it("refuses a non-string value", () => {
    expect(parsePriority(undefined)).toBeNull();
    expect(parsePriority(3)).toBeNull();
  });
});

describe("parseDueDate (FR-006, edge case: due date in the past)", () => {
  it("accepts a real calendar date in YYYY-MM-DD", () => {
    expect(parseDueDate("2026-06-15")).toBe("2026-06-15");
  });

  it("accepts a date in the past", () => {
    expect(parseDueDate("2020-01-01")).toBe("2020-01-01");
  });

  it("refuses an impossible day", () => {
    expect(parseDueDate("2026-02-30")).toBeNull();
  });

  it("refuses February 29 in a non-leap year", () => {
    expect(parseDueDate("2026-02-29")).toBeNull();
  });

  it("accepts February 29 in a leap year", () => {
    expect(parseDueDate("2024-02-29")).toBe("2024-02-29");
  });

  it("refuses a value that does not match YYYY-MM-DD", () => {
    expect(parseDueDate("06/15/2026")).toBeNull();
    expect(parseDueDate("2026-6-15")).toBeNull();
    expect(parseDueDate("")).toBeNull();
  });

  it("refuses a non-string value", () => {
    expect(parseDueDate(undefined)).toBeNull();
    expect(parseDueDate(20260615)).toBeNull();
  });
});