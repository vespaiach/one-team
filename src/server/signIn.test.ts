import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import type { PgUpdateSetSource } from "drizzle-orm/pg-core";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { ApiError } from "./api.ts";
import { connect } from "./db.ts";
import { magicLinks, members, sessions, signInAttempts, signInRequests } from "./schema.ts";
import { endSession, validateSession } from "./session.ts";
import { landingState, redeemSignInLink, requestSignInLink } from "./signIn.ts";
import { hashToken, newToken } from "./tokens.ts";

function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error("Missing setting: TEST_DATABASE_URL");
  }
  return url;
}

const database = connect(testDatabaseUrl());

type SentEmail = { to: string; subject: string; text: string };

type LinkRow = {
  id: number;
  token_hash: string;
  destination: string | null;
  expiry_seconds: number;
};

let fetchMock: Mock<typeof fetch>;
let ipCounter = 0;

function uniqueIp(): string {
  ipCounter += 1;
  return `10.21.${Math.floor(ipCounter / 250)}.${ipCounter % 250}`;
}

function uniqueKey(): string {
  return randomUUID().slice(0, 8);
}

async function insertMember(values: { email: string; active?: boolean; fullName?: string }): Promise<number> {
  const key = uniqueKey();
  const [row] = await database
    .insert(members)
    .values({
      email: values.email,
      fullName: values.fullName ?? `Member ${key}`,
      username: `m-${key}`,
      role: "member",
      active: values.active ?? true,
    })
    .returning({ id: members.id });
  return row.id;
}

async function linkRows(memberId: number): Promise<LinkRow[]> {
  return database
    .select({
      id: magicLinks.id,
      token_hash: magicLinks.tokenHash,
      destination: magicLinks.destination,
      expiry_seconds: sql<number>`extract(epoch from ${magicLinks.expiresAt} - ${magicLinks.createdAt})::float8`,
    })
    .from(magicLinks)
    .where(eq(magicLinks.memberId, memberId))
    .orderBy(magicLinks.id);
}

async function linkCount(): Promise<number> {
  return database.$count(magicLinks);
}

function sentEmails(): SentEmail[] {
  return fetchMock.mock.calls.map(([, init]) => {
    const body = JSON.parse(String(init?.body));
    return { to: body.To[0].Email, subject: body.Subject, text: body.Text };
  });
}

function linkIn(text: string): string {
  const match = text.match(/^http:\/\/localhost:3000\/sign-in\?token=[A-Za-z0-9_-]{43}$/m);
  if (!match) {
    throw new Error("No sign-in link in the email");
  }
  return match[0];
}

function tokenOf(link: string): string {
  return new URL(link).searchParams.get("token") ?? "";
}

function expectedBody(link: string): string {
  return [
    "Use this link to sign in to Tracklite:",
    "",
    link,
    "",
    "The link expires in 15 minutes and works once.",
    "",
    "If you didn't ask to sign in, you can ignore this email.",
  ].join("\n");
}

beforeEach(() => {
  fetchMock = vi.fn<typeof fetch>(async () => new Response(null, { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

afterAll(async () => {
  await database.$client.end();
});

describe("requestSignInLink", () => {
  it("REQ-004.1 active member gets an email and Check your email", async () => {
    const email = `Sam.${uniqueKey()}@Acme.com`;
    const memberId = await insertMember({ email });

    const result = await requestSignInLink(database, {
      email: email.toLowerCase(),
      requestId: randomUUID(),
      next: undefined,
      ip: uniqueIp(),
    });

    expect(result).toEqual({ outcome: "checkEmail" });
    const links = await linkRows(memberId);
    expect(links).toHaveLength(1);
    expect(links[0].expiry_seconds).toBe(900);
    const emails = sentEmails();
    expect(emails).toHaveLength(1);
    expect(emails[0].to).toBe(email);
    expect(emails[0].subject).toBe("Sign in to Tracklite");
    const link = linkIn(emails[0].text);
    expect(emails[0].text).toBe(expectedBody(link));
    expect(new URL(link).origin).toBe(process.env.APP_URL);
    expect(new URL(link).pathname).toBe("/sign-in");
    const token = tokenOf(link);
    expect(token).toHaveLength(43);
    expect(links[0].token_hash).toBe(hashToken(token));
  });

  it("REQ-004.2 non-member gets the same answer and no email is sent", async () => {
    const before = await linkCount();

    const result = await requestSignInLink(database, {
      email: `stranger.${uniqueKey()}@x.com`,
      requestId: randomUUID(),
      next: undefined,
      ip: uniqueIp(),
    });

    expect(result).toEqual({ outcome: "checkEmail" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await linkCount()).toBe(before);
  });

  it("treats Sam@Acme.com as sam@acme.com", async () => {
    const key = uniqueKey();
    const memberId = await insertMember({ email: `sam-${key}@acme.com` });

    const result = await requestSignInLink(database, {
      email: `Sam-${key}@Acme.com`,
      requestId: randomUUID(),
      next: undefined,
      ip: uniqueIp(),
    });

    expect(result).toEqual({ outcome: "checkEmail" });
    expect(await linkRows(memberId)).toHaveLength(1);
    expect(sentEmails().map((sent) => sent.to)).toEqual([`sam-${key}@acme.com`]);
  });

  it("REQ-004.3 two links both work", async () => {
    const email = `sam.${uniqueKey()}@acme.com`;
    const memberId = await insertMember({ email });
    const ip = uniqueIp();

    await requestSignInLink(database, { email, requestId: randomUUID(), next: undefined, ip });
    await requestSignInLink(database, { email, requestId: randomUUID(), next: undefined, ip });

    const tokens = sentEmails().map((sent) => tokenOf(linkIn(sent.text)));
    expect(tokens).toHaveLength(2);
    expect(tokens[0]).not.toBe(tokens[1]);
    for (const token of tokens) {
      const answer = await redeemSignInLink(database, { token, requestId: randomUUID(), sessionToken: null });
      expect(answer).toMatchObject({ outcome: "signedIn" });
    }
    const links = await linkRows(memberId);
    expect(links).toHaveLength(2);
    for (const link of links) {
      expect(await database.$count(sessions, eq(sessions.magicLinkId, link.id))).toBe(1);
    }
  });

  it("gives an inactive member's email the same answer and no email", async () => {
    const email = `gone.${uniqueKey()}@acme.com`;
    const memberId = await insertMember({ email, active: false });

    const result = await requestSignInLink(database, {
      email,
      requestId: randomUUID(),
      next: undefined,
      ip: uniqueIp(),
    });

    expect(result).toEqual({ outcome: "checkEmail" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await linkRows(memberId)).toHaveLength(0);
  });

  const longPath = (length: number) => `/${"a".repeat(length - 1)}`;

  it.each<[string, unknown, string | null]>([
    [
      "a path with its query string",
      "/project/WEB?status=open&sort=new",
      "/project/WEB?status=open&sort=new",
    ],
    ["an API path", "/api/x", "/api/x"],
    ["the health path", "/health", "/health"],
    ["a sign-in path with a token", "/sign-in?token=a", "/sign-in?token=a"],
    ["a 2,048-character path", longPath(2048), longPath(2048)],
    ["another site's address", "https://evil.com", null],
    ["a protocol-relative address", "//evil.com", null],
    ["a backslash address", "/\\evil.com", null],
    ["a path that resolves to another origin", "/\t/evil.com", null],
    ["a 2,049-character path", longPath(2049), null],
    ["a number", 42, null],
    ["an object", { path: "/my-issues" }, null],
    ["nothing", undefined, null],
  ])("stores next as the destination for %s", async (_name, next, destination) => {
    const email = `next.${uniqueKey()}@acme.com`;
    const memberId = await insertMember({ email });

    const result = await requestSignInLink(database, {
      email,
      requestId: randomUUID(),
      next,
      ip: uniqueIp(),
    });

    expect(result).toEqual({ outcome: "checkEmail" });
    const links = await linkRows(memberId);
    expect(links.map((link) => link.destination)).toEqual([destination]);
  });

  it("answers a repeat of an accepted requestId again and ignores its email and next", async () => {
    const email = `repeat.${uniqueKey()}@acme.com`;
    const memberId = await insertMember({ email });
    const otherEmail = `other.${uniqueKey()}@acme.com`;
    const otherId = await insertMember({ email: otherEmail });
    const requestId = randomUUID();
    const ip = uniqueIp();

    await requestSignInLink(database, { email, requestId, next: "/first", ip });
    fetchMock.mockClear();

    const invalidRepeat = await requestSignInLink(database, {
      email: "nope",
      requestId,
      next: "/second",
      ip,
    });
    const otherRepeat = await requestSignInLink(database, {
      email: otherEmail,
      requestId,
      next: "/third",
      ip,
    });

    expect(invalidRepeat).toEqual({ outcome: "checkEmail" });
    expect(otherRepeat).toEqual({ outcome: "checkEmail" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect((await linkRows(memberId)).map((link) => link.destination)).toEqual(["/first"]);
    expect(await linkRows(otherId)).toHaveLength(0);
  });

  it("refuses an invalid email with the field error", async () => {
    const attempt = requestSignInLink(database, {
      email: "nope",
      requestId: randomUUID(),
      next: undefined,
      ip: uniqueIp(),
    });

    await expect(attempt).rejects.toBeInstanceOf(ApiError);
    await expect(attempt).rejects.toMatchObject({
      status: 422,
      message: "Invalid input",
      fields: { email: "Enter a valid email address." },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each<[string, unknown]>([
    ["missing", undefined],
    ["not a UUID", "not-a-uuid"],
    ["not a string", 42],
  ])("refuses a requestId that is %s with Invalid input", async (_name, requestId) => {
    const email = `rid.${uniqueKey()}@acme.com`;
    const memberId = await insertMember({ email });

    const attempt = requestSignInLink(database, { email, requestId, next: undefined, ip: uniqueIp() });

    await expect(attempt).rejects.toBeInstanceOf(ApiError);
    await expect(attempt).rejects.toMatchObject({ status: 422, message: "Invalid input", fields: undefined });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await linkRows(memberId)).toHaveLength(0);
  });
});

type SessionRow = {
  id: number;
  member_id: number;
  magic_link_id: number | null;
  token_hash: string;
  ended_at: Date | null;
};

type RedeemAnswer = Awaited<ReturnType<typeof redeemSignInLink>>;

async function newMember(fullName?: string): Promise<{ id: number; fullName: string; username: string }> {
  const id = await insertMember({ email: `use.${uniqueKey()}@acme.com`, fullName });
  const [row] = await database
    .select({ fullName: members.fullName, username: members.username })
    .from(members)
    .where(eq(members.id, id));
  return { id, ...row };
}

async function insertLink(memberId: number, destination: string | null = null): Promise<string> {
  const token = newToken();
  await database.insert(magicLinks).values({
    memberId,
    tokenHash: hashToken(token),
    destination,
    expiresAt: sql`now() + interval '15 minutes'`,
  });
  return token;
}

async function setLink(token: string, values: PgUpdateSetSource<typeof magicLinks>): Promise<void> {
  await database
    .update(magicLinks)
    .set(values)
    .where(eq(magicLinks.tokenHash, hashToken(token)));
}

async function linkState(token: string): Promise<typeof magicLinks.$inferSelect> {
  const [row] = await database
    .select()
    .from(magicLinks)
    .where(eq(magicLinks.tokenHash, hashToken(token)));
  return row;
}

const sessionRowColumns = {
  id: sessions.id,
  member_id: sessions.memberId,
  magic_link_id: sessions.magicLinkId,
  token_hash: sessions.tokenHash,
  ended_at: sessions.endedAt,
};

async function sessionFor(requestId: string): Promise<SessionRow | undefined> {
  const [row] = await database
    .select(sessionRowColumns)
    .from(sessions)
    .where(eq(sessions.requestId, requestId));
  return row;
}

async function sessionByToken(token: string): Promise<SessionRow> {
  const [row] = await database
    .select(sessionRowColumns)
    .from(sessions)
    .where(eq(sessions.tokenHash, hashToken(token)));
  return row;
}

async function allSessionHashes(): Promise<{ id: number; token_hash: string }[]> {
  return database
    .select({ id: sessions.id, token_hash: sessions.tokenHash })
    .from(sessions)
    .orderBy(sessions.id);
}

function sessionTokenOf(answer: RedeemAnswer): string {
  if (answer.outcome !== "signedIn") {
    throw new Error(`Expected signedIn, got ${answer.outcome}`);
  }
  return answer.sessionToken;
}

async function signIn(memberId: number): Promise<string> {
  const token = await insertLink(memberId);
  return sessionTokenOf(
    await redeemSignInLink(database, { token, requestId: randomUUID(), sessionToken: null }),
  );
}

describe("redeemSignInLink", () => {
  it("REQ-005.1 a link sent 10 minutes ago signs in", async () => {
    const sam = await newMember();
    const token = await insertLink(sam.id, "/project/WEB");
    await setLink(token, {
      createdAt: sql`${magicLinks.createdAt} - interval '10 minutes'`,
      expiresAt: sql`${magicLinks.expiresAt} - interval '10 minutes'`,
    });
    const requestId = randomUUID();

    const answer = await redeemSignInLink(database, { token, requestId, sessionToken: null });

    expect(answer).toEqual({
      outcome: "signedIn",
      destination: "/project/WEB",
      sessionToken: expect.any(String),
    });
    const link = await linkState(token);
    expect(link.usedAt).not.toBeNull();
    const session = await sessionFor(requestId);
    expect(session).toMatchObject({
      member_id: sam.id,
      magic_link_id: link.id,
      token_hash: hashToken(sessionTokenOf(answer)),
      ended_at: null,
    });
    expect(await validateSession(database, sessionTokenOf(answer))).toMatchObject({ id: sam.id });
  });

  it("sends a link without a stored destination to /my-issues", async () => {
    const sam = await newMember();
    const token = await insertLink(sam.id);

    const answer = await redeemSignInLink(database, { token, requestId: randomUUID(), sessionToken: null });

    expect(answer).toMatchObject({ outcome: "signedIn", destination: "/my-issues" });
  });

  it("REQ-005.2 an expired or used link shows expired", async () => {
    const sam = await newMember();
    const expired = await insertLink(sam.id);
    await setLink(expired, { expiresAt: sql`now() - interval '1 second'` });
    const used = await insertLink(sam.id);
    await setLink(used, { usedAt: sql`now()` });

    for (const token of [expired, used]) {
      const requestId = randomUUID();
      const answer = await redeemSignInLink(database, { token, requestId, sessionToken: null });
      expect(answer).toEqual({ outcome: "expired" });
      expect(await sessionFor(requestId)).toBeUndefined();
    }
    expect((await linkState(expired)).usedAt).toBeNull();
  });

  it.each<[string, unknown]>([
    ["an unknown token", newToken()],
    ["a malformed token", "not a token"],
    ["an empty token", ""],
    ["a missing token", undefined],
    ["a token that is not a string", 42],
  ])("answers expired for %s", async (_name, token) => {
    const requestId = randomUUID();

    const answer = await redeemSignInLink(database, { token, requestId, sessionToken: null });

    expect(answer).toEqual({ outcome: "expired" });
    expect(await sessionFor(requestId)).toBeUndefined();
  });

  it("answers expired for an inactive member's link and leaves it unused", async () => {
    const id = await insertMember({ email: `gone.${uniqueKey()}@acme.com`, active: false });
    const token = await insertLink(id);
    const requestId = randomUUID();

    const answer = await redeemSignInLink(database, { token, requestId, sessionToken: null });

    expect(answer).toEqual({ outcome: "expired" });
    expect((await linkState(token)).usedAt).toBeNull();
    expect(await sessionFor(requestId)).toBeUndefined();
  });

  it.each<[string, unknown]>([
    ["missing", undefined],
    ["not a UUID", "not-a-uuid"],
    ["not a string", 42],
  ])("refuses a requestId that is %s with Invalid input", async (_name, requestId) => {
    const sam = await newMember();
    const token = await insertLink(sam.id);

    const attempt = redeemSignInLink(database, { token, requestId, sessionToken: null });

    await expect(attempt).rejects.toBeInstanceOf(ApiError);
    await expect(attempt).rejects.toMatchObject({ status: 422, message: "Invalid input" });
    expect((await linkState(token)).usedAt).toBeNull();
  });

  it("REQ-005.3 opening the landing page does not use the link", async () => {
    const sam = await newMember();
    const token = await insertLink(sam.id);
    const before = await linkState(token);

    expect(await landingState(database, { token, member: null })).toEqual({ state: "signIn" });

    expect(await linkState(token)).toEqual(before);
    const answer = await redeemSignInLink(database, { token, requestId: randomUUID(), sessionToken: null });
    expect(answer).toMatchObject({ outcome: "signedIn" });
  });

  it("gives a signed-out visitor the Sign in button for an unknown and for an expired token", async () => {
    const sam = await newMember();
    const expired = await insertLink(sam.id);
    await setLink(expired, { expiresAt: sql`now() - interval '1 second'` });

    expect(await landingState(database, { token: newToken(), member: null })).toEqual({ state: "signIn" });
    expect(await landingState(database, { token: expired, member: null })).toEqual({ state: "signIn" });
  });

  it("REQ-005.4 the link works in any browser", async () => {
    const email = `any.${uniqueKey()}@acme.com`;
    const memberId = await insertMember({ email });
    await requestSignInLink(database, {
      email,
      requestId: randomUUID(),
      next: "/project/WEB",
      ip: uniqueIp(),
    });
    const token = tokenOf(linkIn(sentEmails()[0].text));

    const answer = await redeemSignInLink(database, { token, requestId: randomUUID(), sessionToken: null });

    expect(answer).toMatchObject({ outcome: "signedIn", destination: "/project/WEB" });
    expect(await validateSession(database, sessionTokenOf(answer))).toMatchObject({ id: memberId });
  });

  it("REQ-005.5 another signed-in member is asked to sign out", async () => {
    const alex = await newMember("Alex Doe");
    const sam = await newMember();
    const alexLink = await insertLink(alex.id);
    const alexRequestId = randomUUID();
    const alexToken = sessionTokenOf(
      await redeemSignInLink(database, { token: alexLink, requestId: alexRequestId, sessionToken: null }),
    );
    const alexSession = await sessionByToken(alexToken);
    const alexExpired = await insertLink(alex.id);
    await setLink(alexExpired, { expiresAt: sql`now() - interval '1 second'` });
    const samLink = await insertLink(sam.id);
    const alexMember = await validateSession(database, alexToken);
    if (alexMember === null) {
      throw new Error("Alex is not signed in");
    }

    for (const token of [samLink, newToken(), "not a token"]) {
      const requestId = randomUUID();
      const answer = await redeemSignInLink(database, { token, requestId, sessionToken: alexToken });
      expect(answer).toEqual({ outcome: "signedInAsOther", fullName: "Alex Doe" });
      expect(await sessionFor(requestId)).toBeUndefined();
      expect(await landingState(database, { token, member: alexMember })).toEqual({
        state: "signedInAsOther",
        fullName: "Alex Doe",
      });
    }
    expect((await linkState(samLink)).usedAt).toBeNull();
    expect(await sessionByToken(alexToken)).toEqual(alexSession);
    expect(await landingState(database, { token: alexLink, member: alexMember })).toEqual({
      state: "signIn",
    });
    expect(await landingState(database, { token: alexExpired, member: alexMember })).toEqual({
      state: "signIn",
    });

    await endSession(database, alexToken);
    const answer = await redeemSignInLink(database, {
      token: samLink,
      requestId: randomUUID(),
      sessionToken: null,
    });
    expect(answer).toMatchObject({ outcome: "signedIn" });
    expect(await validateSession(database, sessionTokenOf(answer))).toMatchObject({ id: sam.id });
  });

  it("signs in with a new link of the signed-in member and ends the previous session", async () => {
    const sam = await newMember();
    const previous = await signIn(sam.id);
    const token = await insertLink(sam.id);

    const answer = await redeemSignInLink(database, {
      token,
      requestId: randomUUID(),
      sessionToken: previous,
    });

    expect(answer).toMatchObject({ outcome: "signedIn" });
    expect((await sessionByToken(previous)).ended_at).not.toBeNull();
    expect(await validateSession(database, previous)).toBeNull();
    expect(await validateSession(database, sessionTokenOf(answer))).toMatchObject({ id: sam.id });
  });

  it("gives one of two concurrent uses of one link signedIn and the other expired", async () => {
    const sam = await newMember();
    const token = await insertLink(sam.id);

    const answers = await Promise.all([
      redeemSignInLink(database, { token, requestId: randomUUID(), sessionToken: null }),
      redeemSignInLink(database, { token, requestId: randomUUID(), sessionToken: null }),
    ]);

    expect(answers.map((answer) => answer.outcome).sort()).toEqual(["expired", "signedIn"]);
    expect(await database.$count(sessions, eq(sessions.memberId, sam.id))).toBe(1);
  });

  it("answers a replay of the same requestId and token with the first answer and a fresh session token", async () => {
    const sam = await newMember();
    const token = await insertLink(sam.id, "/project/WEB");
    const requestId = randomUUID();
    const first = sessionTokenOf(await redeemSignInLink(database, { token, requestId, sessionToken: null }));
    const session = await sessionFor(requestId);

    const replay = await redeemSignInLink(database, { token, requestId, sessionToken: null });

    expect(replay).toEqual({
      outcome: "signedIn",
      destination: "/project/WEB",
      sessionToken: expect.any(String),
    });
    const second = sessionTokenOf(replay);
    expect(second).not.toBe(first);
    expect(await validateSession(database, first)).toBeNull();
    expect(await validateSession(database, second)).toMatchObject({ id: sam.id });
    expect(await sessionFor(requestId)).toEqual({ ...session, token_hash: hashToken(second) });
  });

  it("ends a different live session of the same member when answering a replay", async () => {
    const sam = await newMember();
    const token = await insertLink(sam.id);
    const requestId = randomUUID();
    const lost = sessionTokenOf(await redeemSignInLink(database, { token, requestId, sessionToken: null }));
    const other = await signIn(sam.id);

    const replay = await redeemSignInLink(database, { token, requestId, sessionToken: other });

    expect(replay).toMatchObject({ outcome: "signedIn" });
    expect((await sessionByToken(other)).ended_at).not.toBeNull();
    expect(await validateSession(database, other)).toBeNull();
    expect(await validateSession(database, lost)).toBeNull();
    expect(await validateSession(database, sessionTokenOf(replay))).toMatchObject({ id: sam.id });
    expect((await sessionFor(requestId))?.token_hash).toBe(hashToken(sessionTokenOf(replay)));
  });

  it("does not answer a replay signedIn for a member deactivated since", async () => {
    const sam = await newMember();
    const token = await insertLink(sam.id);
    const requestId = randomUUID();
    await redeemSignInLink(database, { token, requestId, sessionToken: null });
    const session = await sessionFor(requestId);
    await database.update(members).set({ active: false }).where(eq(members.id, sam.id));

    const replay = await redeemSignInLink(database, { token, requestId, sessionToken: null });

    expect(replay).toEqual({ outcome: "expired" });
    expect((await sessionFor(requestId))?.token_hash).toBe(session?.token_hash);
  });

  it("never replaces another member's session with a replay", async () => {
    const alex = await newMember("Alex Doe");
    const sam = await newMember();
    const token = await insertLink(sam.id);
    const requestId = randomUUID();
    await redeemSignInLink(database, { token, requestId, sessionToken: null });
    const samSession = await sessionFor(requestId);
    const alexToken = await signIn(alex.id);

    const retry = await redeemSignInLink(database, { token, requestId, sessionToken: alexToken });

    expect(retry).toEqual({ outcome: "signedInAsOther", fullName: "Alex Doe" });
    expect(await sessionFor(requestId)).toEqual(samSession);
    expect(await validateSession(database, alexToken)).toMatchObject({ id: alex.id });
  });

  it("answers expired to a stored requestId with an unknown or another used link's token", async () => {
    const sam = await newMember();
    const token = await insertLink(sam.id);
    const requestId = randomUUID();
    await redeemSignInLink(database, { token, requestId, sessionToken: null });
    const usedElsewhere = await insertLink(sam.id);
    await redeemSignInLink(database, { token: usedElsewhere, requestId: randomUUID(), sessionToken: null });
    const before = await allSessionHashes();

    for (const wrong of [newToken(), usedElsewhere]) {
      expect(await redeemSignInLink(database, { token: wrong, requestId, sessionToken: null })).toEqual({
        outcome: "expired",
      });
    }

    expect(await allSessionHashes()).toEqual(before);
  });

  it("refuses a stored requestId with a different valid, unused link", async () => {
    const sam = await newMember();
    const token = await insertLink(sam.id);
    const requestId = randomUUID();
    await redeemSignInLink(database, { token, requestId, sessionToken: null });
    const fresh = await insertLink(sam.id);
    const before = await allSessionHashes();
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    const attempt = redeemSignInLink(database, { token: fresh, requestId, sessionToken: null });

    await expect(attempt).rejects.toBeInstanceOf(ApiError);
    await expect(attempt).rejects.toMatchObject({ status: 422, message: "Invalid input" });
    expect(writeSpy.mock.calls.map((call) => String(call[0])).join("")).not.toContain('"level":"error"');
    expect(await allSessionHashes()).toEqual(before);
    expect((await linkState(fresh)).usedAt).toBeNull();
  });

  it("keeps a session whose link was deleted valid but never replays it", async () => {
    const sam = await newMember();
    const token = await insertLink(sam.id);
    const requestId = randomUUID();
    const sessionToken = sessionTokenOf(
      await redeemSignInLink(database, { token, requestId, sessionToken: null }),
    );
    await database.delete(magicLinks).where(eq(magicLinks.tokenHash, hashToken(token)));

    expect((await sessionFor(requestId))?.magic_link_id).toBeNull();
    expect(await validateSession(database, sessionToken)).toMatchObject({ id: sam.id });
    expect(await redeemSignInLink(database, { token, requestId, sessionToken: null })).toEqual({
      outcome: "expired",
    });
    expect((await sessionFor(requestId))?.token_hash).toBe(hashToken(sessionToken));
  });

  it("SEC-007.1 the sign-in log names the member and never the token", async () => {
    const email = `log.${uniqueKey()}@acme.com`;
    const memberId = await insertMember({ email });
    const [{ username }] = await database
      .select({ username: members.username })
      .from(members)
      .where(eq(members.id, memberId));
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await requestSignInLink(database, { email, requestId: randomUUID(), next: undefined, ip: uniqueIp() });
    const link = linkIn(sentEmails()[0].text);
    const answer = await redeemSignInLink(database, {
      token: tokenOf(link),
      requestId: randomUUID(),
      sessionToken: null,
    });
    const sessionToken = sessionTokenOf(answer);
    const output = writeSpy.mock.calls.map((call) => String(call[0])).join("");

    const messages = output
      .split("\n")
      .filter((line) => line !== "")
      .map((line) => (JSON.parse(line) as { message?: string }).message);
    expect(messages.filter((message) => message === `sign-in, member ${username}`)).toHaveLength(1);
    for (const secret of [tokenOf(link), link, sessionToken, email]) {
      expect(output).not.toContain(secret);
    }
  });
});
async function attemptCount(where: { email?: string; ip?: string }): Promise<number> {
  return database.$count(
    signInAttempts,
    and(
      where.email === undefined ? undefined : eq(signInAttempts.emailKey, where.email.trim().toLowerCase()),
      where.ip === undefined ? undefined : eq(signInAttempts.ip, where.ip),
    ),
  );
}

async function requestCount(requestId: string): Promise<number> {
  return database.$count(signInRequests, eq(signInRequests.requestId, requestId));
}

function errorLines(output: string): Record<string, unknown>[] {
  return output
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line) as Record<string, unknown>)
    .filter((line) => line.level === "error");
}

const limitError = { status: 429, message: "Too many sign-in requests. Try again later." };
const sendError = { status: 503, message: "We couldn't send the email. Try again." };

describe("sign-in limits and failed sends", () => {
  it("SEC-001.1 a sixth request for a member's email in an hour is refused", async () => {
    const email = `limit.${uniqueKey()}@acme.com`;
    const memberId = await insertMember({ email });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await requestSignInLink(database, { email, requestId: randomUUID(), next: undefined, ip: uniqueIp() });
    }
    fetchMock.mockClear();

    const sixth = requestSignInLink(database, {
      email,
      requestId: randomUUID(),
      next: undefined,
      ip: uniqueIp(),
    });

    await expect(sixth).rejects.toBeInstanceOf(ApiError);
    await expect(sixth).rejects.toMatchObject(limitError);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await linkRows(memberId)).toHaveLength(5);
  });

  it("SEC-001.2 a non-member email gets the same limit answer", async () => {
    const email = `stranger.${uniqueKey()}@x.com`;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await requestSignInLink(database, { email, requestId: randomUUID(), next: undefined, ip: uniqueIp() });
    }

    const sixth = requestSignInLink(database, {
      email,
      requestId: randomUUID(),
      next: undefined,
      ip: uniqueIp(),
    });

    await expect(sixth).rejects.toBeInstanceOf(ApiError);
    await expect(sixth).rejects.toMatchObject(limitError);
  });

  it("refuses a 21st request from one IP address for 21 different emails", async () => {
    const ip = uniqueIp();
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await requestSignInLink(database, {
        email: `ip.${uniqueKey()}@x.com`,
        requestId: randomUUID(),
        next: undefined,
        ip,
      });
    }

    const twentyFirst = requestSignInLink(database, {
      email: `ip.${uniqueKey()}@x.com`,
      requestId: randomUUID(),
      next: undefined,
      ip,
    });

    await expect(twentyFirst).rejects.toMatchObject(limitError);
    expect(await attemptCount({ ip })).toBe(20);
  });

  it("does not count refused requests, so they don't extend the block", async () => {
    const email = `block.${uniqueKey()}@x.com`;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await requestSignInLink(database, { email, requestId: randomUUID(), next: undefined, ip: uniqueIp() });
    }
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await expect(
        requestSignInLink(database, { email, requestId: randomUUID(), next: undefined, ip: uniqueIp() }),
      ).rejects.toMatchObject(limitError);
    }
    expect(await attemptCount({ email })).toBe(5);

    await database
      .update(signInAttempts)
      .set({ createdAt: sql`${signInAttempts.createdAt} - interval '59 minutes'` })
      .where(eq(signInAttempts.emailKey, email));
    await expect(
      requestSignInLink(database, { email, requestId: randomUUID(), next: undefined, ip: uniqueIp() }),
    ).rejects.toMatchObject(limitError);

    await database
      .update(signInAttempts)
      .set({ createdAt: sql`${signInAttempts.createdAt} - interval '2 minutes'` })
      .where(eq(signInAttempts.emailKey, email));
    const allowed = await requestSignInLink(database, {
      email,
      requestId: randomUUID(),
      next: undefined,
      ip: uniqueIp(),
    });
    expect(allowed).toEqual({ outcome: "checkEmail" });
    expect(await attemptCount({ email })).toBe(6);
  });

  it("answers a replay of an accepted requestId past the limit and adds no row", async () => {
    const email = `replay.${uniqueKey()}@acme.com`;
    await insertMember({ email });
    const first = randomUUID();
    await requestSignInLink(database, { email, requestId: first, next: undefined, ip: uniqueIp() });
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await requestSignInLink(database, { email, requestId: randomUUID(), next: undefined, ip: uniqueIp() });
    }
    await expect(
      requestSignInLink(database, { email, requestId: randomUUID(), next: undefined, ip: uniqueIp() }),
    ).rejects.toMatchObject(limitError);
    fetchMock.mockClear();

    const replay = await requestSignInLink(database, {
      email,
      requestId: first,
      next: undefined,
      ip: uniqueIp(),
    });

    expect(replay).toEqual({ outcome: "checkEmail" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await attemptCount({ email })).toBe(5);
  });

  it("adds no attempt row for a 422", async () => {
    const ip = uniqueIp();

    await expect(
      requestSignInLink(database, { email: "nope", requestId: randomUUID(), next: undefined, ip }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      requestSignInLink(database, {
        email: `ok.${uniqueKey()}@x.com`,
        requestId: "nope",
        next: undefined,
        ip,
      }),
    ).rejects.toMatchObject({ status: 422 });

    expect(await attemptCount({ ip })).toBe(0);
  });

  it.each<[string, () => Promise<Response>, number | "network"]>([
    ["answers 500", async () => Response.json({ error: "down" }, { status: 500 }), 500],
    [
      "rejects",
      async () => {
        throw new TypeError("fetch failed");
      },
      "network",
    ],
  ])("STD-6 a send that %s throws 503 and leaves no usable link", async (_name, failure, status) => {
    const email = `fail.${uniqueKey()}@acme.com`;
    const memberId = await insertMember({ email });
    const requestId = randomUUID();
    fetchMock.mockImplementationOnce(failure);
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    const attempt = requestSignInLink(database, { email, requestId, next: undefined, ip: uniqueIp() });

    await expect(attempt).rejects.toBeInstanceOf(ApiError);
    await expect(attempt).rejects.toMatchObject(sendError);
    const output = writeSpy.mock.calls.map((call) => String(call[0])).join("");
    writeSpy.mockRestore();
    const link = linkIn(sentEmails()[0].text);
    expect(await linkRows(memberId)).toHaveLength(0);
    expect(await requestCount(requestId)).toBe(0);
    expect(await attemptCount({ email })).toBe(1);
    expect(errorLines(output)).toEqual([
      { time: expect.any(String), level: "error", message: "magic-link email failed", status },
    ]);
    for (const secret of [email, link, tokenOf(link)]) {
      expect(output).not.toContain(secret);
    }

    fetchMock.mockClear();
    const repeat = await requestSignInLink(database, { email, requestId, next: undefined, ip: uniqueIp() });

    expect(repeat).toEqual({ outcome: "checkEmail" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await linkRows(memberId)).toHaveLength(1);
    expect(await requestCount(requestId)).toBe(1);
  });

  it("gives a non-member email Check your email while sending fails", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    const result = await requestSignInLink(database, {
      email: `stranger.${uniqueKey()}@x.com`,
      requestId: randomUUID(),
      next: undefined,
      ip: uniqueIp(),
    });

    expect(result).toEqual({ outcome: "checkEmail" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("stored token hashes", () => {
  it("SEC-003.1 stored hashes don't work as a link or a session", async () => {
    const email = `hash.${uniqueKey()}@acme.com`;
    await insertMember({ email });
    await requestSignInLink(database, { email, requestId: randomUUID(), next: undefined, ip: uniqueIp() });
    await requestSignInLink(database, { email, requestId: randomUUID(), next: undefined, ip: uniqueIp() });
    const token = tokenOf(linkIn(sentEmails()[0].text));
    await redeemSignInLink(database, { token, requestId: randomUUID(), sessionToken: null });
    const linkHashes = await database.select({ token_hash: magicLinks.tokenHash }).from(magicLinks);
    const sessionHashes = await database.select({ token_hash: sessions.tokenHash }).from(sessions);
    expect(linkHashes.length).toBeGreaterThan(0);
    expect(sessionHashes.length).toBeGreaterThan(0);

    for (const { token_hash } of linkHashes) {
      expect(
        await redeemSignInLink(database, { token: token_hash, requestId: randomUUID(), sessionToken: null }),
      ).toEqual({ outcome: "expired" });
    }
    for (const { token_hash } of sessionHashes) {
      expect(await validateSession(database, token_hash)).toBeNull();
    }
  });
});