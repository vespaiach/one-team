import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import type { PgUpdateSetSource } from "drizzle-orm/pg-core";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "./db.ts";
import { magicLinks, members, sessions } from "./schema.ts";
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

const database = db();

type TestMember = {
  id: number;
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
  const [row] = await database
    .insert(members)
    .values({
      email: `session-${suffix}@acme.com`,
      fullName: `Session Member ${suffix}`,
      username: `session-${suffix}`,
      role,
      active: options.active ?? true,
    })
    .returning({ id: members.id });
  return { id: row.id, fullName: `Session Member ${suffix}`, username: `session-${suffix}`, role };
}

async function insertMagicLink(memberId: number): Promise<number> {
  const [row] = await database
    .insert(magicLinks)
    .values({ memberId, tokenHash: hashToken(newToken()), expiresAt: sql`now() + interval '15 minutes'` })
    .returning({ id: magicLinks.id });
  return row.id;
}

async function startTestSession(member: TestMember): Promise<string> {
  const magicLinkId = await insertMagicLink(member.id);
  return startSession(database, { memberId: member.id, magicLinkId, requestId: randomUUID() });
}

async function sessionRow(token: string): Promise<SessionRow> {
  const [row] = await database
    .select({
      token_hash: sessions.tokenHash,
      last_active_at: sessions.lastActiveAt,
      ended_at: sessions.endedAt,
    })
    .from(sessions)
    .where(eq(sessions.tokenHash, hashToken(token)));
  return row;
}

async function setSession(token: string, values: PgUpdateSetSource<typeof sessions>): Promise<void> {
  await database
    .update(sessions)
    .set(values)
    .where(eq(sessions.tokenHash, hashToken(token)));
}

async function activeWithinAMinute(token: string): Promise<boolean> {
  const [{ recent }] = await database
    .select({ recent: sql<boolean>`${sessions.lastActiveAt} > now() - interval '1 minute'` })
    .from(sessions)
    .where(eq(sessions.tokenHash, hashToken(token)));
  return recent;
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
  await database.$client.end();
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

    const token = await startSession(database, { memberId: member.id, magicLinkId, requestId });

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const rows = await database.select().from(sessions).where(eq(sessions.requestId, requestId));
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.tokenHash).toBe(hashToken(token));
    expect(row.memberId).toBe(member.id);
    expect(row.magicLinkId).toBe(magicLinkId);
    expect(row.endedAt).toBeNull();
    for (const value of Object.values(row)) {
      expect(String(value)).not.toContain(token);
    }
  });
});

describe("validateSession", () => {
  it("returns the member for a live session and moves last_active_at forward", async () => {
    const member = await insertMember({ role: "admin" });
    const token = await startTestSession(member);
    await setSession(token, { lastActiveAt: sql`now() - interval '1 day'` });
    const before = await sessionRow(token);

    expect(await validateSession(database, token)).toEqual(member);

    const after = await sessionRow(token);
    expect(after.last_active_at.getTime()).toBeGreaterThan(before.last_active_at.getTime());
    expect(await activeWithinAMinute(token)).toBe(true);
  });

  it("returns null for an unknown token", async () => {
    expect(await validateSession(database, newToken())).toBeNull();
  });

  it("returns null for an ended session", async () => {
    const member = await insertMember();
    const token = await startTestSession(member);
    await setSession(token, { endedAt: sql`now()` });

    expect(await validateSession(database, token)).toBeNull();
  });

  it("returns null for a session last active more than 30 days ago", async () => {
    const member = await insertMember();
    const token = await startTestSession(member);
    await setSession(token, { lastActiveAt: sql`now() - interval '30 days 1 minute'` });

    expect(await validateSession(database, token)).toBeNull();
  });

  it("returns null for a session of an inactive member", async () => {
    const member = await insertMember();
    const token = await startTestSession(member);
    await database.update(members).set({ active: false }).where(eq(members.id, member.id));

    expect(await validateSession(database, token)).toBeNull();
  });
});

describe("endSession", () => {
  it("sets ended_at on that one session only", async () => {
    const member = await insertMember();
    const token = await startTestSession(member);
    const otherToken = await startTestSession(member);

    await endSession(database, token);

    expect((await sessionRow(token)).ended_at).toBeInstanceOf(Date);
    expect((await sessionRow(otherToken)).ended_at).toBeNull();
    expect(await validateSession(database, token)).toBeNull();
    expect(await validateSession(database, otherToken)).toEqual(member);
  });

  it("does nothing for an unknown token", async () => {
    const member = await insertMember();
    const token = await startTestSession(member);

    await endSession(database, newToken());

    expect((await sessionRow(token)).ended_at).toBeNull();
  });

  it("does nothing for an already ended session", async () => {
    const member = await insertMember();
    const token = await startTestSession(member);
    await setSession(token, { endedAt: sql`now() - interval '1 hour'` });
    const before = await sessionRow(token);

    await endSession(database, token);

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
    await endSession(database, token);
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
    await endSession(database, token);
    useSessionCookie(token);

    await expect(requireCurrentMember()).rejects.toThrow("NEXT_REDIRECT /sign-in");
    expect(redirect).toHaveBeenCalledWith("/sign-in");
  });
});
describe("sliding session (REQ-006)", () => {
  it("REQ-006.1 daily use keeps the member signed in after 40 days", async () => {
    const member = await insertMember();
    const token = await startTestSession(member);
    await setSession(token, {
      createdAt: sql`now() - interval '40 days'`,
      lastActiveAt: sql`now() - interval '1 day'`,
    });

    expect(await validateSession(database, token)).toEqual(member);

    expect(await activeWithinAMinute(token)).toBe(true);
  });

  it("REQ-006.2 a member away 31 days is signed out", async () => {
    const member = await insertMember();
    const token = await startTestSession(member);
    await setSession(token, { lastActiveAt: sql`now() - interval '31 days'` });

    expect(await validateSession(database, token)).toBeNull();
  });
});