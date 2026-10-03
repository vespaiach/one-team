import { describe, expect, it } from "vitest";
import { isValidEmail } from "./emailAddress.ts";

const domain = "@b.com";

describe("isValidEmail", () => {
  it.each([["sam@acme.com"], ["Sam@Acme.com"], ["  sam@acme.com  "], ["\tsam@acme.com\n"]])(
    "accepts %j",
    (value) => {
      expect(isValidEmail(value)).toBe(true);
    },
  );

  it.each([[""], ["   "], ["nope"], ["a@"], ["@b.com"], ["a b@c.com"]])("rejects %j", (value) => {
    expect(isValidEmail(value)).toBe(false);
  });

  it("accepts a valid 254-character address", () => {
    const value = `${"a".repeat(254 - domain.length)}${domain}`;

    expect(value).toHaveLength(254);
    expect(isValidEmail(value)).toBe(true);
  });

  it("rejects a 255-character address", () => {
    const value = `${"a".repeat(255 - domain.length)}${domain}`;

    expect(value).toHaveLength(255);
    expect(isValidEmail(value)).toBe(false);
  });
});