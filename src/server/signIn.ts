import { and, eq, gt, isNull, ne, type SQL, sql } from "drizzle-orm";
import postgres from "postgres";
import { ApiError } from "./api.ts";
import { readAppSettings } from "./config.ts";
import type { Database, Transaction } from "./db.ts";
import { EmailSendError, sendEmail } from "./email.ts";
import { isValidEmail } from "./emailAddress.ts";
import { writeLogLine } from "./log.ts";
import { findActiveMemberByEmail, type Member } from "./members.ts";
import { magicLinks, members, sessions, signInAttempts, signInRequests } from "./schema.ts";
import { endSession, startSession, validateSession } from "./session.ts";
import { hashToken, newToken } from "./tokens.ts";

type RedeemResult =
  | { outcome: "signedIn"; destination: string; sessionToken: string }
  | { outcome: "signedInAsOther"; fullName: string }
  | { outcome: "expired" };

type LandingState = { state: "signIn" } | { state: "signedInAsOther"; fullName: string };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validRequestId(value: unknown): string {
  if (typeof value !== "string" || !uuidPattern.test(value)) {
    throw new ApiError(422, "Invalid input");
  }
  return value;
}

function sameAppPath(value: unknown, appUrl: string): string | null {
  if (
    typeof value !== "string" ||
    value.length > 2048 ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.startsWith("/\\")
  ) {
    return null;
  }
  return new URL(value, appUrl).origin === appUrl ? value : null;
}

function signInEmailText(link: string): string {
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

async function isBlocked(
  tx: Transaction,
  { matches, limit }: { matches: SQL; limit: number },
): Promise<boolean> {
  const { createdAt } = signInAttempts;
  const [row] = await tx.execute<{ blocked: boolean }>(sql`
    with latest as (select max(${createdAt}) as last from ${signInAttempts} where ${matches})
    select coalesce(
      now() < last + interval '1 hour' and (
        select count(*) from ${signInAttempts}
        where ${matches} and ${createdAt} > last - interval '1 hour' and ${createdAt} <= last
      ) >= ${limit}::int,
      false
    ) as blocked
    from latest
  `);
  return row.blocked;
}

async function lockKey(tx: Transaction, key: string): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`);
}

async function countAttempt(db: Database, { emailKey, ip }: { emailKey: string; ip: string }): Promise<void> {
  const allowed = await db.transaction(async (tx) => {
    await lockKey(tx, `sign-in-email:${emailKey}`);
    await lockKey(tx, `sign-in-ip:${ip}`);
    if (
      (await isBlocked(tx, { matches: eq(signInAttempts.emailKey, emailKey), limit: 5 })) ||
      (await isBlocked(tx, { matches: eq(signInAttempts.ip, ip), limit: 20 }))
    ) {
      return false;
    }
    await tx.insert(signInAttempts).values({ emailKey, ip });
    return true;
  });
  if (!allowed) {
    throw new ApiError(429, "Too many sign-in requests. Try again later.");
  }
}

export async function requestSignInLink(
  db: Database,
  input: { email: unknown; requestId: unknown; next: unknown; ip: string },
): Promise<{ outcome: "checkEmail" }> {
  const requestId = validRequestId(input.requestId);
  const repeated = await db
    .select({ requestId: signInRequests.requestId })
    .from(signInRequests)
    .where(eq(signInRequests.requestId, requestId));
  if (repeated.length > 0) {
    return { outcome: "checkEmail" };
  }
  const { email } = input;
  if (typeof email !== "string" || !isValidEmail(email)) {
    throw new ApiError(422, "Invalid input", { email: "Enter a valid email address." });
  }
  await countAttempt(db, { emailKey: email.trim().toLowerCase(), ip: input.ip });
  const member = await findActiveMemberByEmail(db, email);
  if (member !== null) {
    const { appUrl } = readAppSettings();
    const token = newToken();
    const [link] = await db
      .insert(magicLinks)
      .values({
        memberId: member.id,
        tokenHash: hashToken(token),
        destination: sameAppPath(input.next, appUrl),
        expiresAt: sql`now() + interval '15 minutes'`,
      })
      .returning({
        id: magicLinks.id,
        email: sql<string>`(select ${members.email} from ${members} where ${members.id} = ${magicLinks.memberId})`,
      });
    try {
      await sendEmail({
        to: link.email,
        subject: "Sign in to Tracklite",
        text: signInEmailText(`${appUrl}/sign-in?token=${token}`),
      });
    } catch (error) {
      if (!(error instanceof EmailSendError)) {
        throw error;
      }
      await db.delete(magicLinks).where(eq(magicLinks.id, link.id));
      writeLogLine({
        time: new Date().toISOString(),
        level: "error",
        message: "magic-link email failed",
        status: error.status,
      });
      throw new ApiError(503, "We couldn't send the email. Try again.");
    }
  }
  await db
    .insert(signInRequests)
    .values({ requestId })
    .onConflictDoNothing({ target: signInRequests.requestId });
  return { outcome: "checkEmail" };
}

async function linkMemberId(db: Database, tokenHash: string): Promise<number | null> {
  const [link] = await db
    .select({ memberId: magicLinks.memberId })
    .from(magicLinks)
    .where(eq(magicLinks.tokenHash, tokenHash));
  return link?.memberId ?? null;
}

async function replay(
  db: Database,
  {
    requestId,
    tokenHash,
    sessionToken,
  }: { requestId: string; tokenHash: string; sessionToken: string | null },
): Promise<RedeemResult | null> {
  const [earlier] = await db
    .select({ id: sessions.id, destination: magicLinks.destination })
    .from(sessions)
    .innerJoin(magicLinks, eq(magicLinks.id, sessions.magicLinkId))
    .innerJoin(members, eq(members.id, sessions.memberId))
    .where(
      and(
        eq(sessions.requestId, requestId),
        eq(magicLinks.tokenHash, tokenHash),
        isNull(sessions.endedAt),
        gt(sessions.lastActiveAt, sql`now() - interval '30 days'`),
        eq(members.active, true),
      ),
    );
  if (earlier === undefined) {
    return null;
  }
  const freshToken = newToken();
  await db.transaction(async (tx) => {
    if (sessionToken !== null) {
      await tx
        .update(sessions)
        .set({ endedAt: sql`now()` })
        .where(
          and(
            eq(sessions.tokenHash, hashToken(sessionToken)),
            ne(sessions.id, earlier.id),
            isNull(sessions.endedAt),
          ),
        );
    }
    await tx
      .update(sessions)
      .set({ tokenHash: hashToken(freshToken) })
      .where(eq(sessions.id, earlier.id));
  });
  return { outcome: "signedIn", destination: earlier.destination ?? "/my-issues", sessionToken: freshToken };
}

function isRequestIdConflict(error: unknown): boolean {
  const cause = error instanceof Error ? error.cause : undefined;
  return (
    cause instanceof postgres.PostgresError &&
    cause.code === "23505" &&
    cause.constraint_name === "sessions_request_id_key"
  );
}

async function redeemUnusedLink(
  db: Database,
  {
    requestId,
    tokenHash,
    sessionToken,
  }: { requestId: string; tokenHash: string; sessionToken: string | null },
): Promise<RedeemResult> {
  let signedIn: { destination: string | null; username: string; sessionToken: string } | null;
  try {
    signedIn = await db.transaction(async (tx) => {
      const [link] = await tx
        .update(magicLinks)
        .set({ usedAt: sql`now()` })
        .from(members)
        .where(
          and(
            eq(magicLinks.memberId, members.id),
            eq(magicLinks.tokenHash, tokenHash),
            isNull(magicLinks.usedAt),
            gt(magicLinks.expiresAt, sql`now()`),
            eq(members.active, true),
          ),
        )
        .returning({
          id: magicLinks.id,
          memberId: magicLinks.memberId,
          destination: magicLinks.destination,
          username: members.username,
        });
      if (link === undefined) {
        return null;
      }
      if (sessionToken !== null) {
        await endSession(tx, sessionToken);
      }
      const newSessionToken = await startSession(tx, {
        memberId: link.memberId,
        magicLinkId: link.id,
        requestId,
      });
      return { destination: link.destination, username: link.username, sessionToken: newSessionToken };
    });
  } catch (error) {
    if (isRequestIdConflict(error)) {
      throw new ApiError(422, "Invalid input");
    }
    throw error;
  }
  if (signedIn === null) {
    return { outcome: "expired" };
  }
  writeLogLine({ time: new Date().toISOString(), message: `sign-in, member ${signedIn.username}` });
  return {
    outcome: "signedIn",
    destination: signedIn.destination ?? "/my-issues",
    sessionToken: signedIn.sessionToken,
  };
}

export async function redeemSignInLink(
  db: Database,
  input: { token: unknown; requestId: unknown; sessionToken: string | null },
): Promise<RedeemResult> {
  const requestId = validRequestId(input.requestId);
  const tokenHash = hashToken(typeof input.token === "string" ? input.token : "");
  const current = input.sessionToken === null ? null : await validateSession(db, input.sessionToken);
  if (current !== null && (await linkMemberId(db, tokenHash)) !== current.id) {
    return { outcome: "signedInAsOther", fullName: current.fullName };
  }
  const sessionToken = current === null ? null : input.sessionToken;
  return (
    (await replay(db, { requestId, tokenHash, sessionToken })) ??
    redeemUnusedLink(db, { requestId, tokenHash, sessionToken })
  );
}

export async function landingState(
  db: Database,
  { token, member }: { token: string; member: Member | null },
): Promise<LandingState> {
  if (member === null || (await linkMemberId(db, hashToken(token))) === member.id) {
    return { state: "signIn" };
  }
  return { state: "signedInAsOther", fullName: member.fullName };
}