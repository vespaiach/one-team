import { describe, expect, it } from "vitest";
import { initials } from "./initials.ts";

describe("initials", () => {
  it("takes the first letter of the first and last words", () => {
    expect(initials("Owner Name")).toBe("ON");
  });

  it("REQ-003.4 skips middle words of a long name", () => {
    expect(initials("Alexandria Catherine Montgomery-Fitzwilliam van der Bergholt")).toBe("AB");
  });

  it("REQ-003.4 gives one character for a one-word name", () => {
    expect(initials("Sam")).toBe("S");
  });

  it("ignores surrounding and repeated whitespace and uppercases", () => {
    expect(initials("  sam  lee ")).toBe("SL");
  });

  it("REQ-003.4 keeps a first character that is punctuation or a digit", () => {
    expect(initials("(Contractor) Lee")).toBe("(L");
    expect(initials("3M Team")).toBe("3T");
    expect(initials("'Sam")).toBe("'");
  });

  it("REQ-003.4 keeps characters from scripts without case", () => {
    expect(initials("李 小龙")).toBe("李小");
  });

  it("keeps a first character made of several code points whole", () => {
    expect(initials("émile zola")).toBe("ÉZ");
  });
});