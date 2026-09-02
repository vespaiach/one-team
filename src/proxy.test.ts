import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { config, proxy } from "./proxy";

function requestTo(pathname: string, cookies: Record<string, string> = {}) {
  const request = new NextRequest(new URL(pathname, "https://app.example.com"));
  for (const [name, value] of Object.entries(cookies)) {
    request.cookies.set(name, value);
  }
  return request;
}

describe("proxy (FR-011, research B-3)", () => {
  it("redirects to /signin when no session cookie is present on a protected path", () => {
    const response = proxy(requestTo("/home"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/signin");
  });

  it("passes the request through when a session cookie is present", () => {
    const response = proxy(requestTo("/home", { one_team_session: "some-token" }));

    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("exempts exactly /signin, /reset, /invite/accept, /api/auth/signin, /_next/* and static assets", () => {
    const exempt = [
      "/signin",
      "/reset",
      "/invite/accept",
      "/api/auth/signin",
      "/_next/static/chunk.js",
      "/_next/image",
      "/favicon.ico",
    ];
    const protectedPaths = ["/home", "/api/projects", "/settings"];

    for (const path of exempt) {
      expect(unstable_doesMiddlewareMatch({ config, url: `https://app.example.com${path}` })).toBe(false);
    }
    for (const path of protectedPaths) {
      expect(unstable_doesMiddlewareMatch({ config, url: `https://app.example.com${path}` })).toBe(true);
    }
  });

  it("reads no database", async () => {
    const originalDatabaseUrl = process.env.DATABASE_URL;
    Reflect.deleteProperty(process.env, "DATABASE_URL");
    vi.resetModules();

    try {
      const fresh = await import("./proxy");
      expect(() => fresh.proxy(requestTo("/home"))).not.toThrow();
    } finally {
      process.env.DATABASE_URL = originalDatabaseUrl;
      vi.resetModules();
    }
  });
});