import { describe, expect, it } from "vitest";
import { splitOverflow } from "./overflow";

describe("splitOverflow", () => {
  it("returns every item and no overflow when under the limit", () => {
    expect(splitOverflow([1, 2, 3], 4)).toEqual({ shown: [1, 2, 3], overflowCount: 0 });
  });

  it("returns every item and no overflow when exactly at the limit", () => {
    expect(splitOverflow([1, 2, 3], 3)).toEqual({ shown: [1, 2, 3], overflowCount: 0 });
  });

  it("caps the shown items and counts the rest once over the limit", () => {
    expect(splitOverflow([1, 2, 3, 4, 5], 3)).toEqual({ shown: [1, 2, 3], overflowCount: 2 });
  });
});