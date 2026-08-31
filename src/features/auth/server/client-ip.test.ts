import { afterEach, describe, expect, it } from "vitest";
import { clientIp } from "./client-ip";

const ORIGINAL_TRUST_PROXY = process.env.TRUST_PROXY;

afterEach(() => {
  process.env.TRUST_PROXY = ORIGINAL_TRUST_PROXY;
});

function headersWithForwardedFor(value: string | null) {
  const headers = new Headers();
  if (value !== null) {
    headers.set("x-forwarded-for", value);
  }
  return headers;
}

describe("clientIp (FR-016, research C-3)", () => {
  it("returns unknown when no X-Forwarded-For header is present", () => {
    expect(clientIp(headersWithForwardedFor(null))).toBe("unknown");
  });

  it("reads the first hop of X-Forwarded-For when TRUST_PROXY is unset", () => {
    process.env.TRUST_PROXY = "";
    expect(clientIp(headersWithForwardedFor("203.0.113.4, 198.51.100.9"))).toBe("203.0.113.4");
  });

  it("reads only the last hop of X-Forwarded-For when TRUST_PROXY is set", () => {
    process.env.TRUST_PROXY = "1";
    expect(clientIp(headersWithForwardedFor("203.0.113.4, 198.51.100.9"))).toBe("198.51.100.9");
  });

  it("truncates to 45 characters", () => {
    process.env.TRUST_PROXY = "1";
    const longAddress = "2001:0db8:0000:0000:0000:ff00:0042:8329".repeat(2);
    expect(clientIp(headersWithForwardedFor(longAddress)).length).toBeLessThanOrEqual(45);
  });
});