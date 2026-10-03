import { afterAll, afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { db } from "../../../server/db.ts";
import { members, sessions } from "../../../server/schema.ts";
import { hashToken, newToken } from "../../../server/tokens.ts";
import * as route from "./route.ts";

const database = db();

let writeSpy: MockInstance<typeof process.stdout.write>;

function loggedLines(): Record<string, unknown>[] {
  return writeSpy.mock.calls
    .map((call) => String(call[0]))
    .join("")
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

async function insertSignedInMember(): Promise<string> {
  const suffix = crypto.randomUUID().slice(0, 8);
  const [row] = await database
    .insert(members)
    .values({
      email: `catchall-${suffix}@acme.com`,
      fullName: `Catch All ${suffix}`,
      username: `catchall-${suffix}`,
      role: "member",
    })
    .returning({ id: members.id });
  const token = newToken();
  await database
    .insert(sessions)
    .values({ memberId: row.id, tokenHash: hashToken(token), requestId: crypto.randomUUID() });
  return token;
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

const methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;

const paths = [
  { path: "/api/anything", segments: ["anything"] },
  { path: "/api/nope/deeper", segments: ["nope", "deeper"] },
  { path: "/api", segments: undefined },
  { path: "/api/", segments: undefined },
];

const sameOrigin = { "Sec-Fetch-Site": "same-origin", Origin: "http://localhost:3000" };

function call(
  method: (typeof methods)[number],
  path: string,
  segments: string[] | undefined,
  headers: Record<string, string> = {},
): Promise<Response> {
  return route[method](new Request(`http://localhost:3000${path}`, { method, headers }), {
    params: Promise.resolve({ path: segments }),
  });
}

afterAll(async () => {
  await database.$client.end();
});

describe("api catch-all", () => {
  beforeEach(() => {
    writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  for (const method of methods) {
    for (const { path, segments } of paths) {
      it(`${method} ${path} answers 401 Not signed in as JSON when signed out and logs one timing line`, async () => {
        const response = await call(method, path, segments);

        expect(response.status).toBe(401);
        expect(response.headers.get("content-type")).toContain("application/json");
        if (method !== "HEAD") {
          expect(await response.json()).toEqual({ error: { message: "Not signed in" } });
        }
        expect(sessionCookies(response)).toHaveLength(0);
        const lines = loggedLines();
        expect(lines).toHaveLength(1);
        expect(lines[0]).toMatchObject({ method, path, status: 401 });
      });

      it(`${method} ${path} answers 401 and clears an invalid session cookie`, async () => {
        const response = await call(method, path, segments, {
          ...sameOrigin,
          Cookie: `session=${newToken()}`,
        });

        expect(response.status).toBe(401);
        if (method !== "HEAD") {
          expect(await response.json()).toEqual({ error: { message: "Not signed in" } });
        }
        expectClearingCookie(response);
      });

      it(`${method} ${path} answers a JSON 404 when signed in and logs one timing line`, async () => {
        const token = await insertSignedInMember();

        const response = await call(method, path, segments, { ...sameOrigin, Cookie: `session=${token}` });

        expect(response.status).toBe(404);
        expect(response.headers.get("content-type")).toContain("application/json");
        if (method !== "HEAD") {
          expect(await response.json()).toEqual({ error: { message: "Not found" } });
        }
        expect(sessionCookies(response)).toHaveLength(0);
        const lines = loggedLines();
        expect(lines).toHaveLength(1);
        expect(lines[0]).toMatchObject({ method, path, status: 404 });
      });
    }
  }
});