import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { assertSameOrigin } from "./origin";

const ORIGINAL_APP_URL = process.env.APP_URL;

beforeEach(() => {
  process.env.APP_URL = "https://app.example.com";
});

afterEach(() => {
  process.env.APP_URL = ORIGINAL_APP_URL;
});

function requestWithOrigin(origin: string | undefined, extraHeaders: Record<string, string> = {}) {
  const headers = new Headers(extraHeaders);
  if (origin !== undefined) {
    headers.set("origin", origin);
  }
  return new Request("https://app.example.com/api/auth/signin", { method: "POST", headers });
}

describe("assertSameOrigin (FR-023, research B-5)", () => {
  it("refuses a request with no Origin header, like a foreign one", () => {
    expect(() => assertSameOrigin(requestWithOrigin(undefined))).toThrow();
  });

  it("refuses a foreign Origin", () => {
    expect(() => assertSameOrigin(requestWithOrigin("https://evil.example.com"))).toThrow();
  });

  it("accepts the Origin that matches APP_URL", () => {
    expect(() => assertSameOrigin(requestWithOrigin("https://app.example.com"))).not.toThrow();
  });

  it("derives the expected origin from APP_URL, never from a header on the request under test", () => {
    const request = requestWithOrigin("https://app.example.com", {
      "x-forwarded-host": "evil.example.com",
      host: "evil.example.com",
    });
    expect(() => assertSameOrigin(request)).not.toThrow();
  });
});