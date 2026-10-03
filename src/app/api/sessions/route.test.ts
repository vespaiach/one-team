import { eq, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { connect } from "../../../server/db.ts";
import { magicLinks, members, sessions } from "../../../server/schema.ts";
import { hashToken, newToken } from "../../../server/tokens.ts";
import * as route from "./route.ts";

function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error("Missing setting: TEST_DATABASE_URL");
  }
  return url;
}

const database = connect(testDatabaseUrl());

const run = crypto.randomUUID().slice(0, 8);
let counter = 0;

let writeSpy: MockInstance<typeof process.stdout.write>;

function loggedLines(): Record<string, unknown>[] {
  return writeSpy.mock.calls
    .map((call) => String(call[0]))
    .join("")
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

async function insertMember(fullName: string): Promise<number> {
  counter += 1;
  const [row] = await database
    .insert(members)
    .values({
      email: `m${counter}-${run}@acme.com`,
      fullName: fullName,
      username: `m${counter}-${run}`,
      role: "member",
    })
    .returning({ id: members.id });
  return row.id;
}

async function insertLink(
  memberId: number,
  options: { destination?: string; used?: boolean } = {},
): Promise<string> {
  const token = newToken();
  await database.insert(magicLinks).values({
    memberId,
    tokenHash: hashToken(token),
    destination: options.destination ?? null,
    expiresAt: sql`now() + interval '15 minutes'`,
    usedAt: options.used === true ? sql`now()` : null,
  });
  return token;
}

async function insertSession(memberId: number): Promise<string> {
  const token = newToken();
  await database
    .insert(sessions)
    .values({ memberId, tokenHash: hashToken(token), requestId: crypto.randomUUID() });
  return token;
}

async function linkUsedAt(token: string): Promise<Date | null> {
  const [row] = await database
    .select({ usedAt: magicLinks.usedAt })
    .from(magicLinks)
    .where(eq(magicLinks.tokenHash, hashToken(token)));
  return row.usedAt;
}

const context = { params: Promise.resolve({}) };

afterAll(async () => {
  await database.$client.end();
});

function post(body: string, cookie?: string): Promise<Response> {
  return route.POST(
    new Request("http://localhost:3000/api/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Sec-Fetch-Site": "same-origin",
        Origin: "http://localhost:3000",
        ...(cookie ? { Cookie: `session=${cookie}` } : {}),
      },
      body,
    }),
    context,
  );
}

function sessionCookies(response: Response): string[] {
  return response.headers.getSetCookie().filter((value) => value.startsWith("session="));
}

describe("POST /api/sessions", () => {
  beforeEach(() => {
    writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("signs in with a valid unused link and sets the session cookie", async () => {
    const samId = await insertMember("Sam Lee");
    const token = await insertLink(samId, { destination: "/project/WEB" });

    const response = await post(JSON.stringify({ token, requestId: crypto.randomUUID() }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ outcome: "signedIn", destination: "/project/WEB" });
    const cookies = sessionCookies(response);
    expect(cookies).toHaveLength(1);
    const match = /^session=([A-Za-z0-9_-]{43}); HttpOnly; SameSite=Lax; Path=\/; Max-Age=34560000$/.exec(
      cookies[0],
    );
    expect(match).not.toBeNull();
    const [session] = await database
      .select({ member_id: sessions.memberId, ended_at: sessions.endedAt })
      .from(sessions)
      .where(eq(sessions.tokenHash, hashToken(match?.[1] ?? "")));
    expect(session).toEqual({ member_id: samId, ended_at: null });
    expect(await linkUsedAt(token)).not.toBeNull();
  });

  it("answers expired for a used link with no session cookie", async () => {
    const samId = await insertMember("Sam Lee");
    const token = await insertLink(samId, { used: true });

    const response = await post(JSON.stringify({ token, requestId: crypto.randomUUID() }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ outcome: "expired" });
    expect(sessionCookies(response)).toEqual([]);
  });

  it("answers signedInAsOther with Alex's full name for Sam's link while Alex is signed in", async () => {
    const alexId = await insertMember("Alex Doe");
    const samId = await insertMember("Sam Lee");
    const alexSession = await insertSession(alexId);
    const token = await insertLink(samId);

    const response = await post(JSON.stringify({ token, requestId: crypto.randomUUID() }), alexSession);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ outcome: "signedInAsOther", fullName: "Alex Doe" });
    expect(sessionCookies(response)).toEqual([]);
    expect(await linkUsedAt(token)).toBeNull();
  });

  it("answers 403 to a cross-site request and leaves the link unused", async () => {
    const samId = await insertMember("Sam Lee");
    const token = await insertLink(samId);

    const response = await route.POST(
      new Request("http://localhost:3000/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Sec-Fetch-Site": "cross-site" },
        body: JSON.stringify({ token, requestId: crypto.randomUUID() }),
      }),
      context,
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: { message: "You don't have permission to do that." } });
    expect(sessionCookies(response)).toEqual([]);
    expect(await linkUsedAt(token)).toBeNull();
    expect(await database.$count(sessions, eq(sessions.memberId, samId))).toBe(0);
  });

  const oddTokens: [string, Record<string, unknown>][] = [
    ["an empty", { token: "" }],
    ["a missing", {}],
    ["a number", { token: 42 }],
    ["a null", { token: null }],
    ["an array", { token: ["x"] }],
  ];

  for (const [label, fields] of oddTokens) {
    it(`answers expired, never 422, for ${label} token when signed out`, async () => {
      const response = await post(JSON.stringify({ ...fields, requestId: crypto.randomUUID() }));

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ outcome: "expired" });
    });

    it(`answers signedInAsOther, never 422, for ${label} token when signed in`, async () => {
      const alexId = await insertMember("Alex Doe");
      const alexSession = await insertSession(alexId);

      const response = await post(JSON.stringify({ ...fields, requestId: crypto.randomUUID() }), alexSession);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ outcome: "signedInAsOther", fullName: "Alex Doe" });
    });
  }

  for (const [label, requestId] of [
    ["a missing", undefined],
    ["a non-UUID", "not-a-uuid"],
    ["a non-string", 7],
  ] as const) {
    it(`answers 422 Invalid input for ${label} requestId and leaves the link unused`, async () => {
      const samId = await insertMember("Sam Lee");
      const token = await insertLink(samId);

      const response = await post(JSON.stringify({ token, requestId }));

      expect(response.status).toBe(422);
      expect(await response.json()).toEqual({ error: { message: "Invalid input" } });
      expect(sessionCookies(response)).toEqual([]);
      expect(await linkUsedAt(token)).toBeNull();
    });
  }

  for (const [label, body] of [
    ["not JSON", "{not json"],
    ["JSON null", "null"],
    ["a JSON array", "[]"],
    ["a JSON string", '"text"'],
  ] as const) {
    it(`answers 422 Invalid input for a body that is ${label}`, async () => {
      const response = await post(body);

      expect(response.status).toBe(422);
      expect(await response.json()).toEqual({ error: { message: "Invalid input" } });
      expect(sessionCookies(response)).toEqual([]);
    });
  }
});

const otherMethods = ["GET", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;

describe("other methods on /api/sessions", () => {
  beforeEach(() => {
    writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exports every method Next supports", () => {
    for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const) {
      expect(typeof route[method]).toBe("function");
    }
  });

  for (const method of otherMethods) {
    it(`${method} answers 401 Not signed in as JSON when signed out and logs one timing line`, async () => {
      const response = await route[method](
        new Request("http://localhost:3000/api/sessions", { method }),
        context,
      );

      expect(response.status).toBe(401);
      expect(response.headers.get("content-type")).toContain("application/json");
      expect(await response.json()).toEqual({ error: { message: "Not signed in" } });
      const lines = loggedLines();
      expect(lines).toHaveLength(1);
      expect(lines[0]).toMatchObject({ method, path: "/api/sessions", status: 401 });
    });

    it(`${method} answers 404 Not found as JSON when signed in and logs one timing line`, async () => {
      const memberId = await insertMember("Alex Doe");
      const sessionToken = await insertSession(memberId);

      const response = await route[method](
        new Request("http://localhost:3000/api/sessions", {
          method,
          headers: {
            Cookie: `session=${sessionToken}`,
            "Sec-Fetch-Site": "same-origin",
            Origin: "http://localhost:3000",
          },
        }),
        context,
      );

      expect(response.status).toBe(404);
      expect(response.headers.get("content-type")).toContain("application/json");
      expect(await response.json()).toEqual({ error: { message: "Not found" } });
      const lines = loggedLines();
      expect(lines).toHaveLength(1);
      expect(lines[0]).toMatchObject({ method, path: "/api/sessions", status: 404 });
    });
  }
});