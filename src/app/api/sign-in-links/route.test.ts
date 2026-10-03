import { randomInt, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
  type MockInstance,
} from "vitest";
import { db } from "../../../server/db.ts";
import { magicLinks, members, sessions, signInAttempts, signInRequests } from "../../../server/schema.ts";
import { hashToken, newToken } from "../../../server/tokens.ts";
import * as route from "./route.ts";

const url = "http://localhost:3000/api/sign-in-links";
const path = "/api/sign-in-links";
const context = { params: Promise.resolve({}) };
const methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;
const otherMethods = ["GET", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;
const writeMethods: readonly string[] = ["POST", "PUT", "PATCH", "DELETE"];

let writeSpy: MockInstance<typeof process.stdout.write>;
let fetchMock: Mock<typeof fetch>;

function loggedLines(): Record<string, unknown>[] {
  return writeSpy.mock.calls
    .map((call) => String(call[0]))
    .join("")
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

function uniqueIp(): string {
  return `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`;
}

function uniqueEmail(): string {
  return `${randomUUID()}@acme.com`;
}

async function insertMember(): Promise<{ id: number; email: string }> {
  const email = uniqueEmail();
  const username = `m-${randomUUID().slice(0, 12)}`;
  const [row] = await db()
    .insert(members)
    .values({ email, fullName: "Sam Lee", username, role: "member" })
    .returning({ id: members.id });
  return { id: row.id, email };
}

async function liveSessionCookie(): Promise<string> {
  const member = await insertMember();
  const token = newToken();
  await db()
    .insert(sessions)
    .values({ memberId: member.id, tokenHash: hashToken(token), requestId: randomUUID() });
  return `session=${token}`;
}

async function rowCounts(): Promise<Record<string, number>> {
  return {
    links: await db().$count(magicLinks),
    requests: await db().$count(signInRequests),
    attempts: await db().$count(signInAttempts),
  };
}

function post(body: string, headers: Record<string, string> = { "x-forwarded-for": uniqueIp() }): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", "sec-fetch-site": "same-origin", ...headers },
    body,
  });
}

function postJson(body: unknown, headers?: Record<string, string>): Request {
  return post(JSON.stringify(body), headers);
}

async function unknownIpAttempts(): Promise<number> {
  return db().$count(signInAttempts, eq(signInAttempts.ip, "unknown"));
}

beforeEach(() => {
  writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  fetchMock = vi.fn<typeof fetch>(async () => Response.json({ id: "sent" }, { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

afterAll(async () => {
  await db().$client.end();
});

describe("POST /api/sign-in-links", () => {
  it("answers checkEmail for an active member", async () => {
    const member = await insertMember();

    const response = await route.POST(postJson({ email: member.email, requestId: randomUUID() }), context);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ outcome: "checkEmail" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("answers checkEmail for a non-member alike", async () => {
    const response = await route.POST(postJson({ email: uniqueEmail(), requestId: randomUUID() }), context);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ outcome: "checkEmail" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers 422 with the email field error for an invalid email", async () => {
    const response = await route.POST(postJson({ email: "nope", requestId: randomUUID() }), context);

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: { message: "Invalid input", fields: { email: "Enter a valid email address." } },
    });
  });

  it("answers 422 Invalid input for a missing requestId", async () => {
    const response = await route.POST(postJson({ email: uniqueEmail() }), context);

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: { message: "Invalid input" } });
  });

  it("answers 422 Invalid input for a requestId that is not a UUID", async () => {
    const response = await route.POST(postJson({ email: uniqueEmail(), requestId: "not-a-uuid" }), context);

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: { message: "Invalid input" } });
  });

  it("answers 422 Invalid input with no side effects for a body that is not JSON", async () => {
    const before = await rowCounts();

    const response = await route.POST(post("{not json"), context);

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: { message: "Invalid input" } });
    expect(await rowCounts()).toEqual(before);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers 422 Invalid input with no side effects for a JSON body that is not an object", async () => {
    const before = await rowCounts();

    const response = await route.POST(post("null"), context);

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: { message: "Invalid input" } });
    expect(await rowCounts()).toEqual(before);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers 403 to a cross-site request and changes nothing", async () => {
    const member = await insertMember();
    const requestId = randomUUID();
    const ip = uniqueIp();

    const response = await route.POST(
      postJson({ email: member.email, requestId }, { "x-forwarded-for": ip, "sec-fetch-site": "cross-site" }),
      context,
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: { message: "You don't have permission to do that." } });
    expect(fetchMock).not.toHaveBeenCalled();
    expect({
      links: await db().$count(magicLinks, eq(magicLinks.memberId, member.id)),
      requests: await db().$count(signInRequests, eq(signInRequests.requestId, requestId)),
      attempts: await db().$count(signInAttempts, eq(signInAttempts.ip, ip)),
    }).toEqual({ links: 0, requests: 0, attempts: 0 });
  });

  it("answers 429 with the limit message once an email is past its limit", async () => {
    const email = uniqueEmail();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const accepted = await route.POST(postJson({ email, requestId: randomUUID() }), context);
      expect(accepted.status).toBe(200);
    }

    const response = await route.POST(postJson({ email, requestId: randomUUID() }), context);

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      error: { message: "Too many sign-in requests. Try again later." },
    });
  });

  it("answers 503 with the send-failed message when the email can't be sent", async () => {
    const member = await insertMember();
    fetchMock.mockResolvedValue(Response.json({ error: "down" }, { status: 500 }));

    const response = await route.POST(postJson({ email: member.email, requestId: randomUUID() }), context);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: { message: "We couldn't send the email. Try again." } });
  });

  describe("without a usable X-Forwarded-For entry", () => {
    beforeEach(async () => {
      await db().delete(signInAttempts).where(eq(signInAttempts.ip, "unknown"));
    });

    it("answers checkEmail when the header is missing", async () => {
      const response = await route.POST(
        postJson({ email: uniqueEmail(), requestId: randomUUID() }, {}),
        context,
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ outcome: "checkEmail" });
      expect(await unknownIpAttempts()).toBe(1);
    });

    it("answers checkEmail when the rightmost entry is empty", async () => {
      const response = await route.POST(
        postJson({ email: uniqueEmail(), requestId: randomUUID() }, { "x-forwarded-for": "1.2.3.4, " }),
        context,
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ outcome: "checkEmail" });
      expect(await unknownIpAttempts()).toBe(1);
    });
  });
});

describe("other methods on /api/sign-in-links", () => {
  it("exports every method Next supports", () => {
    for (const method of methods) {
      expect(route[method]).toBeTypeOf("function");
    }
  });

  for (const method of otherMethods) {
    it(`${method} answers 401 Not signed in when signed out and logs one timing line`, async () => {
      const response = await route[method](new Request(url, { method }), context);

      expect(response.status).toBe(401);
      expect(response.headers.get("content-type")).toContain("application/json");
      if (method !== "HEAD") {
        expect(await response.json()).toEqual({ error: { message: "Not signed in" } });
      }
      const lines = loggedLines();
      expect(lines).toHaveLength(1);
      expect(lines[0]).toMatchObject({ method, path, status: 401 });
    });

    it(`${method} answers 404 Not found when signed in and logs one timing line`, async () => {
      const cookie = await liveSessionCookie();
      const headers: Record<string, string> = writeMethods.includes(method)
        ? { cookie, "sec-fetch-site": "same-origin", origin: "http://localhost:3000" }
        : { cookie };

      const response = await route[method](new Request(url, { method, headers }), context);

      expect(response.status).toBe(404);
      expect(response.headers.get("content-type")).toContain("application/json");
      if (method !== "HEAD") {
        expect(await response.json()).toEqual({ error: { message: "Not found" } });
      }
      const lines = loggedLines();
      expect(lines).toHaveLength(1);
      expect(lines[0]).toMatchObject({ method, path, status: 404 });
    });
  }
});