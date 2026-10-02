import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { hashToken, newToken } from "./tokens.ts";

describe("newToken", () => {
  it("returns a 43-character base64url string", () => {
    expect(newToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("gives 1,000 distinct values in 1,000 calls", () => {
    const tokens = new Set(Array.from({ length: 1000 }, () => newToken()));

    expect(tokens.size).toBe(1000);
  });
});

describe("hashToken", () => {
  it("returns the 64-character lowercase hex SHA-256 of the token", () => {
    const token = newToken();

    const hash = hashToken(token);

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(createHash("sha256").update(token).digest("hex"));
  });

  it("is stable for the same input and differs from the token", () => {
    const token = newToken();

    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).not.toBe(token);
  });
});