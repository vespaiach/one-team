import { describe, expect, it } from "vitest";
import { digestToken, hashPassword, issueToken, verifyPassword } from "./crypto";

describe("crypto (FR-028, FR-029, research B-10)", () => {
  it("hashPassword sets memoryCost, timeCost and parallelism explicitly", async () => {
    const hash = await hashPassword("a-compliant-password");
    expect(hash).toContain("$argon2id$");
    expect(hash).toContain("m=19456,t=2,p=1");
  });

  it("round-trips a stored hash through verifyPassword", async () => {
    const hash = await hashPassword("a-compliant-password");
    await expect(verifyPassword(hash, "a-compliant-password")).resolves.toBe(true);
    await expect(verifyPassword(hash, "the-wrong-password")).resolves.toBe(false);
  });

  it("issueToken draws 32 CSPRNG bytes and returns a 64-character SHA-256 hex digest", () => {
    const { token, digest } = issueToken();

    expect(Buffer.from(token, "base64url")).toHaveLength(32);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(digestToken(token)).toBe(digest);
  });

  it("issueToken draws fresh randomness on every call", () => {
    const first = issueToken();
    const second = issueToken();
    expect(first.token).not.toBe(second.token);
    expect(first.digest).not.toBe(second.digest);
  });
});