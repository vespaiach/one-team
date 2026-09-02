import { describe, expect, it } from "vitest";
import { displayName } from "./display-name";

describe("displayName (FR-017, SC-010, OT-UX-019)", () => {
  it("joins first and last name with a single space", () => {
    expect(displayName({ firstName: "Ada", lastName: "Lovelace" })).toBe("Ada Lovelace");
  });

  it("carries both parts through unmodified, including internal spacing", () => {
    expect(displayName({ firstName: "Mary Jane", lastName: "Watson" })).toBe("Mary Jane Watson");
  });
});