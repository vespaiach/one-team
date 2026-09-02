import { describe, expect, it } from "vitest";
import { classifyToken, TOKEN_SHAPE } from "./token-state";

describe("classifyToken (FR-032, B-1)", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");
  const past = new Date(now.getTime() - 1000);
  const future = new Date(now.getTime() + 1000);

  it("reports valid when unspent and not yet expired", () => {
    expect(classifyToken({ spentAt: null, expiresAt: future }, now)).toBe("valid");
  });

  it("reports expired when unspent and past its expiry", () => {
    expect(classifyToken({ spentAt: null, expiresAt: past }, now)).toBe("expired");
  });

  it("reports used when spent and not expired", () => {
    expect(classifyToken({ spentAt: past, expiresAt: future }, now)).toBe("used");
  });

  it("reports used beating expired when both spent and past its expiry", () => {
    expect(classifyToken({ spentAt: past, expiresAt: past }, now)).toBe("used");
  });
});

describe("TOKEN_SHAPE (F-1)", () => {
  it("accepts exactly what R1's reset page accepts today", () => {
    expect(TOKEN_SHAPE.test("a".repeat(43))).toBe(true);
    expect(TOKEN_SHAPE.test("A-Za-z0-9_-".repeat(2))).toBe(true);
    expect(TOKEN_SHAPE.test("a".repeat(20))).toBe(true);
  });

  it("rejects a token shorter than 20 characters", () => {
    expect(TOKEN_SHAPE.test("a".repeat(19))).toBe(false);
  });

  it("rejects an empty token", () => {
    expect(TOKEN_SHAPE.test("")).toBe(false);
  });

  it("rejects a token carrying characters outside the URL-safe alphabet", () => {
    expect(TOKEN_SHAPE.test("not a real token!")).toBe(false);
  });
});