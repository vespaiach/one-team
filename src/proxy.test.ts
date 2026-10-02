import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { afterAll, describe, expect, it } from "vitest";
import { config, proxy } from "./proxy.ts";
import { db } from "./server/db.ts";
import { hashToken, newToken } from "./server/tokens.ts";

const sql = db();
const origin = "http://localhost:3000";

afterAll(async () => {
  await sql.end();
});

async function insertSession(): Promise<string> {
  const suffix = crypto.randomUUID().slice(0, 8);
  const [row] = await sql<{ id: string }[]>`
    insert into members (email, full_name, username, role)
    values (${`proxy-${suffix}@acme.com`}, ${`Proxy Member ${suffix}`}, ${`proxy-${suffix}`}, 'member')
    returning id::text as id
  `;
  const token = newToken();
  await sql`
    insert into sessions (member_id, token_hash, request_id)
    values (${row.id}, ${hashToken(token)}, ${crypto.randomUUID()})
  `;
  return token;
}

async function lastActiveAt(token: string): Promise<Date> {
  const [row] = await sql<{ last_active_at: Date }[]>`
    select last_active_at from sessions where token_hash = ${hashToken(token)}
  `;
  return row.last_active_at;
}

function request(path: string, token: string | null = null): NextRequest {
  const headers: Record<string, string> = token === null ? {} : { cookie: `theme=dark; session=${token}` };
  return new NextRequest(`${origin}${path}`, { headers });
}

function sessionCookies(response: Response): string[] {
  return response.headers.getSetCookie().filter((value) => value.startsWith("session="));
}

function expectClearingCookie(response: Response): void {
  const cookies = sessionCookies(response);
  expect(cookies).toHaveLength(1);
  const parts = cookies[0].split("; ");
  expect(parts[0]).toBe("session=");
  expect(parts).toContain("Path=/");
  expect(parts).toContain("Max-Age=0");
}

function expectRedirect(response: Response, pathAndQuery: string): void {
  expect(response.status).toBeGreaterThanOrEqual(300);
  expect(response.status).toBeLessThan(400);
  const location = response.headers.get("location");
  expect(location).not.toBeNull();
  const url = new URL(location as string, origin);
  expect(url.origin).toBe(origin);
  expect(url.pathname + url.search).toBe(pathAndQuery);
}

function expectPass(response: Response): void {
  expect(response.headers.get("location")).toBeNull();
  expect(response.headers.get("x-middleware-next")).toBe("1");
}

async function signedOut(path: string, token: string | null = null): Promise<Response> {
  return proxy(request(path, token));
}

async function signedIn(path: string): Promise<Response> {
  const token = await insertSession();
  await sql`
    update sessions set last_active_at = now() - interval '1 day' where token_hash = ${hashToken(token)}
  `;
  const before = await lastActiveAt(token);

  const response = await proxy(request(path, token));

  expect((await lastActiveAt(token)).getTime()).toBeGreaterThan(before.getTime());
  expect(sessionCookies(response)).toEqual([]);
  return response;
}

describe("proxy, signed out", () => {
  it("redirects / to /sign-in without a next parameter", async () => {
    const response = await signedOut("/");
    expectRedirect(response, "/sign-in");
    expect(sessionCookies(response)).toEqual([]);
  });

  it("redirects /my-issues to /sign-in?next=%2Fmy-issues", async () => {
    expectRedirect(await signedOut("/my-issues"), "/sign-in?next=%2Fmy-issues");
  });

  it("redirects /project/WEB to /sign-in?next=%2Fproject%2FWEB", async () => {
    expectRedirect(await signedOut("/project/WEB"), "/sign-in?next=%2Fproject%2FWEB");
  });

  it("keeps the query string in next", async () => {
    const response = await signedOut("/project/WEB/list?status=open");
    expectRedirect(response, "/sign-in?next=%2Fproject%2FWEB%2Flist%3Fstatus%3Dopen");
    const next = new URL(response.headers.get("location") as string, origin).searchParams.get("next");
    expect(next).toBe("/project/WEB/list?status=open");
  });

  it("drops Next's _rsc parameter from next", async () => {
    expectRedirect(await signedOut("/project/WEB?_rsc=abc123"), "/sign-in?next=%2Fproject%2FWEB");
    expectRedirect(
      await signedOut("/project/WEB/list?status=open&_rsc=abc123"),
      "/sign-in?next=%2Fproject%2FWEB%2Flist%3Fstatus%3Dopen",
    );
  });

  it("lets /sign-in through", async () => {
    const response = await signedOut("/sign-in");
    expectPass(response);
    expect(sessionCookies(response)).toEqual([]);
  });

  it("lets /sign-in?token=x through", async () => {
    const response = await signedOut("/sign-in?token=x");
    expectPass(response);
    expect(sessionCookies(response)).toEqual([]);
  });

  it("clears an unknown session cookie on the redirect", async () => {
    const response = await signedOut("/my-issues", newToken());
    expectRedirect(response, "/sign-in?next=%2Fmy-issues");
    expectClearingCookie(response);
  });

  it("clears an unknown session cookie on the redirect from /", async () => {
    const response = await signedOut("/", newToken());
    expectRedirect(response, "/sign-in");
    expectClearingCookie(response);
  });

  it("clears the cookie of an ended session on the redirect", async () => {
    const token = await insertSession();
    await sql`update sessions set ended_at = now() where token_hash = ${hashToken(token)}`;

    const response = await signedOut("/project/WEB", token);

    expectRedirect(response, "/sign-in?next=%2Fproject%2FWEB");
    expectClearingCookie(response);
  });

  it("REQ-006.2 a lapsed session returns to the requested page", async () => {
    const token = await insertSession();
    await sql`
      update sessions set last_active_at = now() - interval '31 days' where token_hash = ${hashToken(token)}
    `;

    const response = await signedOut("/project/WEB?x=1", token);

    expectRedirect(response, "/sign-in?next=%2Fproject%2FWEB%3Fx%3D1");
    expectClearingCookie(response);
  });

  it("clears an unknown session cookie on /sign-in", async () => {
    const response = await signedOut("/sign-in", newToken());
    expectPass(response);
    expectClearingCookie(response);
  });

  it("clears an unknown session cookie on /sign-in?token=x", async () => {
    const response = await signedOut("/sign-in?token=x", newToken());
    expectPass(response);
    expectClearingCookie(response);
  });
});

describe("proxy, signed in", () => {
  it("redirects / to /my-issues", async () => {
    expectRedirect(await signedIn("/"), "/my-issues");
  });

  it("redirects /sign-in to /my-issues", async () => {
    expectRedirect(await signedIn("/sign-in"), "/my-issues");
  });

  it("redirects /sign-in?next=/project/WEB to /my-issues, ignoring next", async () => {
    expectRedirect(await signedIn("/sign-in?next=/project/WEB"), "/my-issues");
  });

  it("lets /sign-in?token=x through", async () => {
    expectPass(await signedIn("/sign-in?token=x"));
  });

  it("lets /sign-in?token= (empty) through", async () => {
    expectPass(await signedIn("/sign-in?token="));
  });

  it("lets /sign-in?token=a&token=b (repeated) through", async () => {
    expectPass(await signedIn("/sign-in?token=a&token=b"));
  });

  it("lets /my-issues through", async () => {
    expectPass(await signedIn("/my-issues"));
  });

  it("lets /project/WEB through", async () => {
    expectPass(await signedIn("/project/WEB"));
  });
});

describe("proxy config.matcher", () => {
  function matches(url: string): boolean {
    return unstable_doesMiddlewareMatch({ config, url });
  }

  it.each(["/api", "/api/", "/api/projects", "/api/sessions/current", "/health"])("excludes %s", (url) => {
    expect(matches(url)).toBe(false);
  });

  it.each(["/_next/static/chunks/main.js", "/_next/image?url=%2Flogo.png&w=64&q=75", "/favicon.ico"])(
    "excludes %s",
    (url) => {
      expect(matches(url)).toBe(false);
    },
  );

  it.each([
    "/",
    "/sign-in",
    "/sign-in?token=x",
    "/my-issues",
    "/project/WEB",
    "/project/WEB/list?status=open",
  ])("runs on page %s", (url) => {
    expect(matches(url)).toBe(true);
  });
});