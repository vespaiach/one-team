import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { ApiError } from "./api.ts";
import { db } from "./db.ts";
import { requireAdmin, requireMember } from "./permissions.ts";
import { magicLinks, members, sessions } from "./schema.ts";
import { endSession, startSession } from "./session.ts";
import { hashToken, newToken } from "./tokens.ts";

const database = db();

type TestMember = {
  id: number;
  fullName: string;
  username: string;
  role: "admin" | "member";
};

async function insertMember(role: "admin" | "member" = "member"): Promise<TestMember> {
  const suffix = randomUUID().slice(0, 8);
  const [row] = await database
    .insert(members)
    .values({
      email: `permissions-${suffix}@acme.com`,
      fullName: `Permissions Member ${suffix}`,
      username: `permissions-${suffix}`,
      role,
    })
    .returning({ id: members.id });
  return { id: row.id, fullName: `Permissions Member ${suffix}`, username: `permissions-${suffix}`, role };
}

async function startTestSession(member: TestMember): Promise<string> {
  const [link] = await database
    .insert(magicLinks)
    .values({
      memberId: member.id,
      tokenHash: hashToken(newToken()),
      expiresAt: sql`now() + interval '15 minutes'`,
    })
    .returning({ id: magicLinks.id });
  return startSession(database, { memberId: member.id, magicLinkId: link.id, requestId: randomUUID() });
}

async function lastActiveAt(token: string): Promise<Date> {
  const [row] = await database
    .select({ lastActiveAt: sessions.lastActiveAt })
    .from(sessions)
    .where(eq(sessions.tokenHash, hashToken(token)));
  return row.lastActiveAt;
}

function apiRequest(token: string | null): Request {
  const headers: Record<string, string> = token === null ? {} : { cookie: `theme=dark; session=${token}` };
  return new Request("http://localhost:3000/api/projects", { headers });
}

async function expectNotSignedIn(request: Request): Promise<void> {
  const error = await requireMember(request).then(
    () => null,
    (thrown: unknown) => thrown,
  );
  expect(error).toBeInstanceOf(ApiError);
  expect((error as ApiError).status).toBe(401);
  expect((error as ApiError).message).toBe("Not signed in");
}

async function adminCheck(request: Request): Promise<unknown> {
  return requireMember(request)
    .then((member) => requireAdmin(member))
    .then(
      () => null,
      (thrown: unknown) => thrown,
    );
}

afterAll(async () => {
  await database.$client.end();
});

describe("requireMember", () => {
  it("throws 401 Not signed in when the request has no session cookie", async () => {
    await expectNotSignedIn(apiRequest(null));
  });

  it("throws 401 Not signed in for an unknown token", async () => {
    await expectNotSignedIn(apiRequest(newToken()));
  });

  it("throws 401 Not signed in for an ended session", async () => {
    const member = await insertMember();
    const token = await startTestSession(member);
    await endSession(database, token);

    await expectNotSignedIn(apiRequest(token));
  });

  it("throws 401 Not signed in for a session last active more than 30 days ago", async () => {
    const member = await insertMember();
    const token = await startTestSession(member);
    await database
      .update(sessions)
      .set({ lastActiveAt: sql`now() - interval '30 days 1 minute'` })
      .where(eq(sessions.tokenHash, hashToken(token)));

    await expectNotSignedIn(apiRequest(token));
  });

  it("returns the member for a live session and moves last_active_at forward", async () => {
    const member = await insertMember("admin");
    const token = await startTestSession(member);
    await database
      .update(sessions)
      .set({ lastActiveAt: sql`now() - interval '1 day'` })
      .where(eq(sessions.tokenHash, hashToken(token)));
    const before = await lastActiveAt(token);

    expect(await requireMember(apiRequest(token))).toEqual(member);

    expect((await lastActiveAt(token)).getTime()).toBeGreaterThan(before.getTime());
  });
});

describe("requireAdmin", () => {
  it("lets an Admin pass", async () => {
    const admin = await insertMember("admin");
    const token = await startTestSession(admin);

    expect(await adminCheck(apiRequest(token))).toBeNull();
  });

  it("throws 403 You don't have permission to do that. for a Member", async () => {
    const member = await insertMember("member");
    const token = await startTestSession(member);

    const error = await adminCheck(apiRequest(token));

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(403);
    expect((error as ApiError).message).toBe("You don't have permission to do that.");
  });

  it("fails earlier at requireMember with 401 when the request has no valid session", async () => {
    const error = await adminCheck(apiRequest(newToken()));

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(401);
    expect((error as ApiError).message).toBe("Not signed in");
  });
});