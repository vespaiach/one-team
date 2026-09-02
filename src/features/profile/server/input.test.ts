import { describe, expect, it } from "vitest";
import { parseAvatarField, parseOptionalField, parseRequiredField } from "./input";

describe("parseRequiredField (FR-007, FR-012, FR-020)", () => {
  it("trims and accepts a non-empty value", () => {
    expect(parseRequiredField("  Ada  ", 200)).toEqual({ ok: true, value: "Ada" });
  });

  it("refuses an empty value after trimming", () => {
    expect(parseRequiredField("   ", 200)).toEqual({ ok: false, reason: "required" });
  });

  it("refuses a value over its bound, counted in code points", () => {
    expect(parseRequiredField("a".repeat(201), 200)).toEqual({ ok: false, reason: "too_long" });
  });

  it("accepts a value at exactly its bound", () => {
    expect(parseRequiredField("a".repeat(200), 200)).toEqual({ ok: true, value: "a".repeat(200) });
  });

  it("counts an astral character as one code point, not two UTF-16 units", () => {
    const value = "😀".repeat(200);
    expect(parseRequiredField(value, 200)).toEqual({ ok: true, value });
    expect(parseRequiredField(`${value}😀`, 200)).toEqual({ ok: false, reason: "too_long" });
  });

  it("does not alter interior whitespace", () => {
    expect(parseRequiredField("Mary  Jane", 200)).toEqual({ ok: true, value: "Mary  Jane" });
  });

  it("refuses a value that is not a string, without coercing it", () => {
    expect(parseRequiredField(undefined, 200).ok).toBe(false);
    expect(parseRequiredField(42, 200).ok).toBe(false);
    expect(parseRequiredField({}, 200).ok).toBe(false);
    expect(parseRequiredField(null, 200).ok).toBe(false);
  });
});

describe("parseOptionalField (FR-008, FR-012, FR-012a, FR-020)", () => {
  it("trims and accepts a non-empty value", () => {
    expect(parseOptionalField("  @ada  ", 200)).toEqual({ ok: true, value: "@ada" });
  });

  it("maps an empty-after-trim value to null rather than an empty string", () => {
    expect(parseOptionalField("   ", 200)).toEqual({ ok: true, value: null });
    expect(parseOptionalField("", 200)).toEqual({ ok: true, value: null });
  });

  it("applies no format rule to a Slack handle or a phone number", () => {
    expect(parseOptionalField("+44 7700 900000", 200)).toEqual({ ok: true, value: "+44 7700 900000" });
    expect(parseOptionalField("not-a-real-handle!!", 200)).toEqual({
      ok: true,
      value: "not-a-real-handle!!",
    });
  });

  it("refuses a value over its bound, counted in code points", () => {
    expect(parseOptionalField("a".repeat(10001), 10000)).toEqual({ ok: false, reason: "too_long" });
  });

  it("accepts a value at exactly its bound", () => {
    const value = "a".repeat(10000);
    expect(parseOptionalField(value, 10000)).toEqual({ ok: true, value });
  });

  it("preserves line breaks in a multi-line value", () => {
    expect(parseOptionalField("line one\nline two", 10000)).toEqual({
      ok: true,
      value: "line one\nline two",
    });
  });

  it("refuses a value that is not a string, without coercing it", () => {
    expect(parseOptionalField(undefined, 200).ok).toBe(false);
    expect(parseOptionalField(42, 200).ok).toBe(false);
  });
});

describe("parseAvatarField (FR-011, FR-012a, FR-020, SC-010)", () => {
  it("accepts an http link", () => {
    expect(parseAvatarField("http://example.com/a.png", 2000)).toEqual({
      ok: true,
      value: "http://example.com/a.png",
    });
  });

  it("accepts an https link", () => {
    expect(parseAvatarField("https://example.com/a.png", 2000)).toEqual({
      ok: true,
      value: "https://example.com/a.png",
    });
  });

  it("accepts an uppercase scheme, case-insensitively", () => {
    const result = parseAvatarField("HTTPS://example.com/a.png", 2000);
    expect(result.ok).toBe(true);
  });

  it("clears rather than refuses an empty value, skipping the scheme rule entirely", () => {
    expect(parseAvatarField("   ", 2000)).toEqual({ ok: true, value: null });
  });

  it("refuses a javascript scheme", () => {
    expect(parseAvatarField("javascript:alert(1)", 2000)).toEqual({
      ok: false,
      reason: "avatar_scheme",
    });
  });

  it("refuses a data scheme", () => {
    expect(parseAvatarField("data:image/png;base64,aaaa", 2000)).toEqual({
      ok: false,
      reason: "avatar_scheme",
    });
  });

  it("refuses a mailto scheme", () => {
    expect(parseAvatarField("mailto:someone@example.com", 2000)).toEqual({
      ok: false,
      reason: "avatar_scheme",
    });
  });

  it("refuses a relative value with no scheme at all", () => {
    expect(parseAvatarField("example.com/a.png", 2000)).toEqual({
      ok: false,
      reason: "avatar_scheme",
    });
  });

  it("stores a well-formed link that does not point at an image, without fetching it", () => {
    expect(parseAvatarField("https://example.com/not-an-image", 2000)).toEqual({
      ok: true,
      value: "https://example.com/not-an-image",
    });
  });

  it("refuses a value over its bound before the scheme is even relevant", () => {
    const overLong = `https://example.com/${"a".repeat(2000)}`;
    expect(parseAvatarField(overLong, 2000)).toEqual({ ok: false, reason: "too_long" });
  });

  it("refuses a value that is not a string, without coercing it", () => {
    expect(parseAvatarField(undefined, 2000).ok).toBe(false);
    expect(parseAvatarField(42, 2000).ok).toBe(false);
  });
});