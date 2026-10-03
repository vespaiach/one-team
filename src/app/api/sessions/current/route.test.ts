import { afterAll, afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { db } from "../../../../server/db.ts";
import { validateSession } from "../../../../server/session.ts";
import { hashToken, newToken } from "../../../../server/tokens.ts";
import * as catchAll from "../../[[...path]]/route.ts";
import * as route from "./route.ts";

const sql = db();

let writeSpy: MockInstance<typeof process.stdout.write>;

function loggedLines(): Record<string, unknown>[] {
  return writeSpy.mock.calls
    .map((call) => String(call[0]))
    .join("")
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

async function insertMember(): Promise<string> {
  const suffix = crypto.randomUUID().slice(0, 8);
  const [row] = await sql<{ id: string }[]>`
    insert into members (email, full_name, username, role)
    values (${`current-${suffix}@acme.com`}, ${`Current Member ${suffix}`}, ${`current-${suffix}`}, 'member')
    returning id::text as id
  `;
  return row.id;
}

async function insertSession(memberId: string, options: { ended?: boolean } = {}): Promise<string> {
  const token = newToken();
  await sql`
    insert into sessions (member_id, token_hash, request_id, ended_at)
    values (
      ${memberId},
      ${hashToken(token)},
      ${crypto.randomUUID()},
      case when ${options.ended === true} then now() - interval '1 day' end
    )
  `;
  return token;
}

async function endedAt(token: string): Promise<Date | null> {
  const [row] = await sql<{ ended_at: Date | null }[]>`
    select ended_at from sessions where token_hash = ${hashToken(token)}
  `;
  return row.ended_at;
}

const context = { params: Promise.resolve({}) };

function signOut(cookie?: string): Promise<Response> {
  return route.DELETE(
    new Request("http://localhost:3000/api/sessions/current", {
      method: "DELETE",
      headers: {
        "Sec-Fetch-Site": "same-origin",
        Origin: "http://localhost:3000",
        ...(cookie ? { Cookie: `session=${cookie}` } : {}),
      },
    }),
    context,
  );
}

function expectClearingCookie(response: Response): void {
  const cookies = response.headers.getSetCookie().filter((value) => value.startsWith("session="));
  expect(cookies).toHaveLength(1);
  const parts = cookies[0].split("; ");
  expect(parts[0]).toBe("session=");
  expect(parts).toContain("Path=/");
  expect(parts).toContain("Max-Age=0");
}

afterAll(async () => {
  await sql.end();
});

describe("DELETE /api/sessions/current", () => {
  beforeEach(() => {
    writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("ends the live session named by the cookie, answers 204 and clears the cookie", async () => {
    const memberId = await insertMember();
    const token = await insertSession(memberId);

    const response = await signOut(token);

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expectClearingCookie(response);
    expect(await endedAt(token)).toBeInstanceOf(Date);
    const lines = loggedLines();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ method: "DELETE", path: "/api/sessions/current", status: 204 });
  });

  it("answers 204 with the clearing cookie, never 401, when there is no cookie", async () => {
    const response = await signOut();

    expect(response.status).toBe(204);
    expectClearingCookie(response);
  });

  it("answers 204 with the clearing cookie, never 401, for an unknown cookie", async () => {
    const response = await signOut(newToken());

    expect(response.status).toBe(204);
    expectClearingCookie(response);
  });

  it("answers 204 with the clearing cookie, never 401, for an already ended session and leaves it as it was", async () => {
    const memberId = await insertMember();
    const token = await insertSession(memberId, { ended: true });
    const before = await endedAt(token);

    const response = await signOut(token);

    expect(response.status).toBe(204);
    expectClearingCookie(response);
    expect(await endedAt(token)).toEqual(before);
  });

  it("ends only the session it names, so the member's other session stays signed in", async () => {
    const memberId = await insertMember();
    const laptop = await insertSession(memberId);
    const desktop = await insertSession(memberId);

    const response = await signOut(laptop);

    expect(response.status).toBe(204);
    expect(await endedAt(laptop)).toBeInstanceOf(Date);
    expect(await endedAt(desktop)).toBeNull();
    expect(await validateSession(sql, laptop)).toBeNull();
    expect(await validateSession(sql, desktop)).toMatchObject({ id: memberId });
  });

  it("answers 403 to a cross-site request and leaves the session live", async () => {
    const memberId = await insertMember();
    const token = await insertSession(memberId);

    const response = await route.DELETE(
      new Request("http://localhost:3000/api/sessions/current", {
        method: "DELETE",
        headers: { "Sec-Fetch-Site": "cross-site", Cookie: `session=${token}` },
      }),
      context,
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: { message: "You don't have permission to do that." } });
    expect(response.headers.getSetCookie().filter((value) => value.startsWith("session="))).toEqual([]);
    expect(await endedAt(token)).toBeNull();
    expect(await validateSession(sql, token)).toMatchObject({ id: memberId });
  });

  it("makes the signed-out cookie value answer 401 when it is sent again", async () => {
    const memberId = await insertMember();
    const token = await insertSession(memberId);
    await signOut(token);

    const response = await catchAll.GET(
      new Request("http://localhost:3000/api/anything", {
        headers: { Cookie: `session=${token}`, "Sec-Fetch-Site": "same-origin" },
      }),
      { params: Promise.resolve({ path: ["anything"] }) },
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: { message: "Not signed in" } });
  });
});

const otherMethods = ["GET", "POST", "PUT", "PATCH", "HEAD", "OPTIONS"] as const;

describe("other methods on /api/sessions/current", () => {
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
        new Request("http://localhost:3000/api/sessions/current", { method }),
        context,
      );

      expect(response.status).toBe(401);
      expect(response.headers.get("content-type")).toContain("application/json");
      expect(await response.json()).toEqual({ error: { message: "Not signed in" } });
      const lines = loggedLines();
      expect(lines).toHaveLength(1);
      expect(lines[0]).toMatchObject({ method, path: "/api/sessions/current", status: 401 });
    });

    it(`${method} answers 404 Not found as JSON when signed in and logs one timing line`, async () => {
      const memberId = await insertMember();
      const token = await insertSession(memberId);

      const response = await route[method](
        new Request("http://localhost:3000/api/sessions/current", {
          method,
          headers: {
            Cookie: `session=${token}`,
            "Sec-Fetch-Site": "same-origin",
            Origin: "http://localhost:3000",
          },
        }),
        context,
      );

      expect(response.status).toBe(404);
      expect(response.headers.get("content-type")).toContain("application/json");
      expect(await response.json()).toEqual({ error: { message: "Not found" } });
      expect(await endedAt(token)).toBeNull();
      const lines = loggedLines();
      expect(lines).toHaveLength(1);
      expect(lines[0]).toMatchObject({ method, path: "/api/sessions/current", status: 404 });
    });
  }
});