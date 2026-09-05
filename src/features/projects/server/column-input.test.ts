import { describe, expect, it } from "vitest";
import { parseColumnId, parsePlacement, parseProjectKey } from "./column-input";

const WELL_FORMED_UUID = "01a06d3f-9c2e-7b41-8a55-3f7c1d9e4b20";

describe("parseColumnId (FR-053, gate 3)", () => {
  it("accepts a well-formed UUID", () => {
    expect(parseColumnId(WELL_FORMED_UUID)).toBe(WELL_FORMED_UUID);
  });

  it.each([
    ["an empty string", ""],
    ["a word", "abc"],
    ["a UUID carrying a trailing character", `${WELL_FORMED_UUID}0`],
    ["a UUID missing its last character", WELL_FORMED_UUID.slice(0, -1)],
    ["a UUID with a stray space", ` ${WELL_FORMED_UUID}`],
  ])("rejects %s", (_label, value) => {
    expect(parseColumnId(value)).toBeNull();
  });

  it.each([
    ["a number", 7],
    ["null", null],
    ["undefined", undefined],
    ["an object", { id: WELL_FORMED_UUID }],
  ])("rejects %s without coercing it", (_label, value) => {
    expect(parseColumnId(value)).toBeNull();
  });
});

describe("parseProjectKey (FR-053, gate 3)", () => {
  it.each(["W", "WR", "WR2026", "ABCDEFGH"])("accepts the well-formed key %s", (value) => {
    expect(parseProjectKey(value)).toBe(value);
  });

  it.each([
    ["an empty string", ""],
    ["a lowercase key", "wr"],
    ["a key opening with a digit", "1WR"],
    ["a key of nine characters", "ABCDEFGHI"],
    ["a key carrying a hyphen", "WR-1"],
    ["a key carrying a space", "W R"],
  ])("rejects %s", (_label, value) => {
    expect(parseProjectKey(value)).toBeNull();
  });

  it.each([
    ["a number", 7],
    ["null", null],
    ["undefined", undefined],
  ])("rejects %s without coercing it", (_label, value) => {
    expect(parseProjectKey(value)).toBeNull();
  });
});

describe("parsePlacement (FR-053, gate 3)", () => {
  it.each(["before", "after"] as const)("accepts the literal %s", (value) => {
    expect(parsePlacement(value)).toBe(value);
  });

  it.each([
    ["an empty string", ""],
    ["a capitalised literal", "Before"],
    ["a near miss", "afterwards"],
    ["a third placement", "first"],
  ])("rejects %s rather than defaulting to after", (_label, value) => {
    expect(parsePlacement(value)).toBeNull();
  });

  it.each([
    ["a number", 0],
    ["a boolean", true],
    ["null", null],
    ["undefined", undefined],
  ])("rejects %s without coercing it", (_label, value) => {
    expect(parsePlacement(value)).toBeNull();
  });
});