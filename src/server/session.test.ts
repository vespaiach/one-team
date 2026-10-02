import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "./db.ts";
import {
  clearSessionCookie,
  currentMember,
  endSession,
  readSessionToken,
  requireCurrentMember,
  sessionCookie,
  startSession,
  validateSession,
} from "./session.ts";
import { hashToken, newToken } from "./tokens.ts";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const sql = db();

type TestMember = {
  id: string;
  fullName: string;
  username: string;
  role: "admin" | "member";
};

type SessionRow = {
  token_hash: string;
  last_active_at: Date;
  ended_at: Date | null;
};

async function insertMember(
  options: { role?: "admin" | "member"; active?: boolean } = {},
): Promise<TestMember> {
  const suffix = randomUUID().slice(0, 8);
  const role = options.role ?? "member";
  const [row] = await sql<{ id: string }[]>`
    insert into members (email, full_name, username, role, active)
    values (${`session-${suffix}@acme.com`}, ${`Session Member ${suffix}`}, ${`session-${suffix}`}, ${role}, ${options.active ?? true})
    returning id::text as id
  `;
  return { id: row.id, fullName: `Session Member ${suffix}`, username: `session-${suffix}`, role };
}

async function insertMagicLink(memberId: string): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    insert into magic_links (member_id, token_hash, expires_at)
    values (${memberId}, ${hashToken(newToken())}, now() + interval '15 minutes')
    returning id::text as id
  `;
  return row.id;
}

async function startTestSession(member: TestMember): Promise<string> {
  const magicLinkId = await insertMagicLink(member.id);
  return startSession(sql, { memberId: member.id, magicLinkId, requestId: randomUUID() });
}

async function sessionRow(token: string): Promise<SessionRow> {
  const [row] = await sql<SessionRow[]>`
    select token_hash, last_active_at, ended_at from sessions where token_hash = ${hashToken(token)}
  `;
  return row;
}

function useSessionCookie(token: string | null): void {
  const store = {
    get: (name: string) => (name === "session" && token !== null ? { name, value: token } : undefined),
  };
  vi.mocked(cookies).mockResolvedValue(store as unknown as Awaited<ReturnType<typeof cookies>>);
}

function cookieParts(header: string): string[] {
  return header.split("; ");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

afterAll(async () => {
  await sql.end();
});

describe("sessionCookie", () => {
  it("sets the session token for 400 days, HttpOnly and SameSite=Lax, without Secure in local development", () => {
    vi.stubEnv("NODE_ENV", "development");
    const token = newToken();

    expect(sessionCookie(token)).toBe(`session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=34560000`);
  });

  it("adds Secure in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const token = newToken();

    expect(cookieParts(sessionCookie(token)).toSorted()).toEqual(
      [`session=${token}`, "HttpOnly", "SameSite=Lax", "Path=/", "Max-Age=34560000", "Secure"].toSorted(),
    );
  });
});

describe("clearSessionCookie", () => {
  it("clears the session cookie with Max-Age=0 on the same path", () => {
    vi.stubEnv("NODE_ENV", "development");
    const parts = cookieParts(clearSessionCookie());

    expect(parts[0]).toBe("session=");
    expect(parts).toContain("Path=/");
    expect(parts).toContain("Max-Age=0");
    expect(parts).not.toContain("Secure");
  });

  it("adds Secure in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const parts = cookieParts(clearSessionCookie());

    expect(parts[0]).toBe("session=");
    expect(parts).toContain("Max-Age=0");
    expect(parts).toContain("Secure");
  });
});

describe("readSessionToken", () => {
  it("reads the session value from the Cookie header", () => {
    const token = newToken();
    const request = new Request("http://localhost:3000/my-issues", {
      headers: { cookie: `theme=dark; session=${token}; other=1` },
    });

    expect(readSessionToken(request)).toBe(token);
  });

  it("returns null when the request has no Cookie header", () => {
    expect(readSessionToken(new Request("http://localhost:3000/my-issues"))).toBeNull();
  });

  it("returns null when the Cookie header has no session cookie", () => {
    const request = new Request("http://localhost:3000/my-issues", { headers: { cookie: "theme=dark" } });

    expect(readSessionToken(request)).toBeNull();
  });
});

describe("startSession", () => {
  it("stores only the hash of the token, never the raw token", async () => {
    const member = await insertMember();
    const magicLinkId = await insertMagicLink(member.id);
    const requestId = randomUUID();

    const token = await startSession(sql, { memberId: member.id, magicLinkId, requestId });

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const rows = await sql<{ row: Record<string, unknown> }[]>`
      select row_to_json(sessions.*) as row from sessions where request_id = ${requestId}
    `;
    expect(rows).toHaveLength(1);
    const row = rows[0].row;
    expect(row.token_hash).toBe(hashToken(token));
    expect(String(row.member_id)).toBe(member.id);
    expect(String(row.magic_link_id)).toBe(magicLinkId);
    expect(row.ended_at).toBeNull();
    for (const value of Object.values(row)) {
      expect(String(value)).not.toContain(token);
    }
  });
});

describe("validateSession", () => {
  it("returns the member for a live session and moves last_active_at forward", async () => {
    const member = await insertMember({ role: "admin" });
    const token = await startTestSession(member);
    await sql`
      update sessions set last_active_at = now() - interval '1 day' where token_hash = ${hashToken(token)}
    `;
    const before = await sessionRow(token);

    expect(await validateSession(sql, token)).toEqual(member);

    const after = await sessionRow(token);
    expect(after.last_active_at.getTime()).toBeGreaterThan(before.last_active_at.getTime());
    const [{ recent }] = await sql<{ recent: boolean }[]>`
      select last_active_at > now() - interval '1 minute' as recent from sessions where token_hash = ${hashToken(token)}
    `;
    expect(recent).toBe(true);
  });

  it("returns null for an unknown token", async () => {
    expect(await validateSession(sql, newToken())).toBeNull();
  });

  it("returns null for an ended session", async () => {
    const member = await insertMember();
    const token = await startTestSession(member);
    await sql`update sessions set ended_at = now() where token_hash = ${hashToken(token)}`;

    expect(await validateSession(sql, token)).toBeNull();
  });

  it("returns null for a session last active more than 30 days ago", async () => {
    const member = await insertMember();
    const token = await startTestSession(member);
    await sql`
      update sessions set last_active_at = now() - interval '30 days 1 minute' where token_hash = ${hashToken(token)}
    `;

    expect(await validateSession(sql, token)).toBeNull();
  });

  it("returns null for a session of an inactive member", async () => {
    const member = await insertMember();
    const token = await startTestSession(member);
    await sql`update members set active = false where id = ${member.id}`;

    expect(await validateSession(sql, token)).toBeNull();
  });
});

describe("endSession", () => {
  it("sets ended_at on that one session only", async () => {
    const member = await insertMember();
    const token = await startTestSession(member);
    const otherToken = await startTestSession(member);

    await endSession(sql, token);

    expect((await sessionRow(token)).ended_at).toBeInstanceOf(Date);
    expect((await sessionRow(otherToken)).ended_at).toBeNull();
    expect(await validateSession(sql, token)).toBeNull();
    expect(await validateSession(sql, otherToken)).toEqual(member);
  });

  it("does nothing for an unknown token", async () => {
    const member = await insertMember();
    const token = await startTestSession(member);

    await endSession(sql, newToken());

    expect((await sessionRow(token)).ended_at).toBeNull();
  });

  it("does nothing for an already ended session", async () => {
    const member = await insertMember();
    const token = await startTestSession(member);
    await sql`
      update sessions set ended_at = now() - interval '1 hour' where token_hash = ${hashToken(token)}
    `;
    const before = await sessionRow(token);

    await endSession(sql, token);

    expect((await sessionRow(token)).ended_at).toEqual(before.ended_at);
  });
});

describe("currentMember", () => {
  beforeEach(() => {
    vi.mocked(cookies).mockReset();
  });

  it("returns the member for a live session cookie", async () => {
    const member = await insertMember();
    const token = await startTestSession(member);
    useSessionCookie(token);

    expect(await currentMember()).toEqual(member);
  });

  it("returns null when there is no session cookie", async () => {
    useSessionCookie(null);

    expect(await currentMember()).toBeNull();
  });

  it("returns null for an unknown token", async () => {
    useSessionCookie(newToken());

    expect(await currentMember()).toBeNull();
  });

  it("returns null for an ended session", async () => {
    const member = await insertMember();
    const token = await startTestSession(member);
    await endSession(sql, token);
    useSessionCookie(token);

    expect(await currentMember()).toBeNull();
  });
});
describe("requireCurrentMember", () => {
  beforeEach(() => {
    vi.mocked(cookies).mockReset();
    vi.mocked(redirect).mockReset();
    vi.mocked(redirect).mockImplementation((url: string) => {
      throw new Error(`NEXT_REDIRECT ${url}`);
    });
  });

  it("returns the member for a live session cookie and does not redirect", async () => {
    const member = await insertMember();
    const token = await startTestSession(member);
    useSessionCookie(token);

    expect(await requireCurrentMember()).toEqual(member);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("redirects to /sign-in when there is no session cookie", async () => {
    useSessionCookie(null);

    await expect(requireCurrentMember()).rejects.toThrow("NEXT_REDIRECT /sign-in");
    expect(redirect).toHaveBeenCalledWith("/sign-in");
  });

  it("redirects to /sign-in for an unknown token", async () => {
    useSessionCookie(newToken());

    await expect(requireCurrentMember()).rejects.toThrow("NEXT_REDIRECT /sign-in");
    expect(redirect).toHaveBeenCalledWith("/sign-in");
  });

  it("redirects to /sign-in for an ended session", async () => {
    const member = await insertMember();
    const token = await startTestSession(member);
    await endSession(sql, token);
    useSessionCookie(token);

    await expect(requireCurrentMember()).rejects.toThrow("NEXT_REDIRECT /sign-in");
    expect(redirect).toHaveBeenCalledWith("/sign-in");
  });
});
describe("sliding session (REQ-006)", () => {
  it("REQ-006.1 daily use keeps the member signed in after 40 days", async () => {
    const member = await insertMember();
    const token = await startTestSession(member);
    await sql`
      update sessions
      set created_at = now() - interval '40 days', last_active_at = now() - interval '1 day'
      where token_hash = ${hashToken(token)}
    `;

    expect(await validateSession(sql, token)).toEqual(member);

    const [{ recent }] = await sql<{ recent: boolean }[]>`
      select last_active_at > now() - interval '1 minute' as recent from sessions where token_hash = ${hashToken(token)}
    `;
    expect(recent).toBe(true);
  });

  it("REQ-006.2 a member away 31 days is signed out", async () => {
    const member = await insertMember();
    const token = await startTestSession(member);
    await sql`
      update sessions set last_active_at = now() - interval '31 days' where token_hash = ${hashToken(token)}
    `;

    expect(await validateSession(sql, token)).toBeNull();
  });
});