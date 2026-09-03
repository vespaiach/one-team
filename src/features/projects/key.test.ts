import { describe, expect, it } from "vitest";
import { deriveProjectKey, isValidProjectKey } from "./key";

describe("deriveProjectKey (FR-025)", () => {
  it("derives the first letter of each word, uppercased", () => {
    expect(deriveProjectKey("Website Redesign")).toBe("WR");
  });

  it("derives from four words", () => {
    expect(deriveProjectKey("One Team Design Ops")).toBe("OTDO");
  });

  it("derives empty when the candidate fails the key pattern", () => {
    expect(deriveProjectKey("3D Redesign")).toBe("");
  });

  it("does not split a word on a hyphen", () => {
    expect(deriveProjectKey("Re-Design")).toBe("R");
  });

  it("truncates a name of more than eight words to eight characters", () => {
    expect(deriveProjectKey("Alpha Bravo Charlie Delta Echo Foxtrot Golf Hotel India")).toBe("ABCDEFGH");
  });

  it("derives empty from punctuation-only words", () => {
    expect(deriveProjectKey("!!! ???")).toBe("");
  });
});

describe("isValidProjectKey", () => {
  it("accepts a single uppercase letter", () => {
    expect(isValidProjectKey("R")).toBe(true);
  });

  it("accepts uppercase letters and digits up to eight characters", () => {
    expect(isValidProjectKey("ABCDEFGH")).toBe(true);
  });

  it("rejects a key starting with a digit", () => {
    expect(isValidProjectKey("3R")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isValidProjectKey("")).toBe(false);
  });

  it("rejects lowercase letters", () => {
    expect(isValidProjectKey("wr")).toBe(false);
  });

  it("rejects more than eight characters", () => {
    expect(isValidProjectKey("ABCDEFGHI")).toBe(false);
  });
});