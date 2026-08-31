import { describe, expect, it } from "vitest";
import { parseEmail, parsePassword } from "./input";

describe("parseEmail (FR-063, FR-006)", () => {
  it("refuses an address over 200 characters", () => {
    const overlong = `${"a".repeat(195)}@example.com`;
    expect(overlong.length).toBeGreaterThan(200);
    expect(parseEmail(overlong)).toBeNull();
  });

  it("refuses a malformed address", () => {
    expect(parseEmail("not-an-address")).toBeNull();
    expect(parseEmail("")).toBeNull();
  });

  it("refuses a non-string value", () => {
    expect(parseEmail(undefined)).toBeNull();
    expect(parseEmail(42)).toBeNull();
  });

  it("folds a valid address with Unicode-aware lower-casing", () => {
    expect(parseEmail("Ada@Example.com")).toBe("ada@example.com");
  });
});

describe("parsePassword (FR-063)", () => {
  it("refuses a password over 128 characters", () => {
    expect(parsePassword("a".repeat(129))).toBeNull();
  });

  it("accepts a password at exactly 128 characters", () => {
    expect(parsePassword("a".repeat(128))).toBe("a".repeat(128));
  });

  it("refuses a non-string value", () => {
    expect(parsePassword(undefined)).toBeNull();
  });
});