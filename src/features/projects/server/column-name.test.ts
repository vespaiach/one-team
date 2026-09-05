import { describe, expect, it } from "vitest";
import { parseColumnName } from "./column-name";

describe("parseColumnName (FR-004)", () => {
  it("trims before it bounds", () => {
    expect(parseColumnName(" Todo ")).toEqual({ ok: true, name: "Todo" });
  });

  it("refuses an empty name as required", () => {
    expect(parseColumnName("")).toEqual({ ok: false, reason: "required" });
  });

  it("refuses a whitespace-only name as required", () => {
    expect(parseColumnName("   ")).toEqual({ ok: false, reason: "required" });
  });

  it("accepts exactly 200 characters after trimming", () => {
    const name = "x".repeat(200);
    expect(parseColumnName(` ${name} `)).toEqual({ ok: true, name });
  });

  it("refuses 201 characters and never truncates", () => {
    expect(parseColumnName("x".repeat(201))).toEqual({ ok: false, reason: "too_long" });
  });

  it("leaves internal whitespace, Unicode form and zero-width characters alone", () => {
    expect(parseColumnName("  In  Progress  ")).toEqual({ ok: true, name: "In  Progress" });
    expect(parseColumnName("Café")).toEqual({ ok: true, name: "Café" });
    expect(parseColumnName("To​do")).toEqual({ ok: true, name: "To​do" });
  });

  it("refuses a value that is not a string", () => {
    expect(parseColumnName(42)).toEqual({ ok: false, reason: "required" });
    expect(parseColumnName(null)).toEqual({ ok: false, reason: "required" });
    expect(parseColumnName(undefined)).toEqual({ ok: false, reason: "required" });
  });
});