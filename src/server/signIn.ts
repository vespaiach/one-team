import postgres, { type Sql, type TransactionSql } from "postgres";
import { ApiError } from "./api.ts";
import { readAppSettings } from "./config.ts";
import { EmailSendError, sendEmail } from "./email.ts";
import { isValidEmail } from "./emailAddress.ts";
import { writeLogLine } from "./log.ts";
import { findActiveMemberByEmail, type Member } from "./members.ts";
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
  sql: TransactionSql,
  { column, value, limit }: { column: "email_key" | "ip"; value: string; limit: number },
): Promise<boolean> {
  const [row] = await sql<{ blocked: boolean }[]>`
    with latest as (select max(created_at) as last from sign_in_attempts where ${sql(column)} = ${value})
    select coalesce(
      now() < last + interval '1 hour' and (
        select count(*) from sign_in_attempts
        where ${sql(column)} = ${value} and created_at > last - interval '1 hour' and created_at <= last
      ) >= ${limit}::int,
      false
    ) as blocked
    from latest
  `;
  return row.blocked;
}

async function countAttempt(sql: Sql, { emailKey, ip }: { emailKey: string; ip: string }): Promise<void> {
  const allowed = await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtextextended(${`sign-in-email:${emailKey}`}, 0))`;
    await tx`select pg_advisory_xact_lock(hashtextextended(${`sign-in-ip:${ip}`}, 0))`;
    if (
      (await isBlocked(tx, { column: "email_key", value: emailKey, limit: 5 })) ||
      (await isBlocked(tx, { column: "ip", value: ip, limit: 20 }))
    ) {
      return false;
    }
    await tx`insert into sign_in_attempts (email_key, ip) values (${emailKey}, ${ip})`;
    return true;
  });
  if (!allowed) {
    throw new ApiError(429, "Too many sign-in requests. Try again later.");
  }
}

export async function requestSignInLink(
  sql: Sql,
  input: { email: unknown; requestId: unknown; next: unknown; ip: string },
): Promise<{ outcome: "checkEmail" }> {
  const requestId = validRequestId(input.requestId);
  const repeated = await sql`select 1 from sign_in_requests where request_id = ${requestId}`;
  if (repeated.length > 0) {
    return { outcome: "checkEmail" };
  }
  const { email } = input;
  if (typeof email !== "string" || !isValidEmail(email)) {
    throw new ApiError(422, "Invalid input", { email: "Enter a valid email address." });
  }
  await countAttempt(sql, { emailKey: email.trim().toLowerCase(), ip: input.ip });
  const member = await findActiveMemberByEmail(sql, email);
  if (member !== null) {
    const { appUrl } = readAppSettings();
    const token = newToken();
    const [link] = await sql<{ id: string; email: string }[]>`
      insert into magic_links (member_id, token_hash, destination, expires_at)
      values (${member.id}, ${hashToken(token)}, ${sameAppPath(input.next, appUrl)}, now() + interval '15 minutes')
      returning id::text as id, (select email from members where id = member_id) as email
    `;
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
      await sql`delete from magic_links where id = ${link.id}`;
      writeLogLine({
        time: new Date().toISOString(),
        level: "error",
        message: "magic-link email failed",
        status: error.status,
      });
      throw new ApiError(503, "We couldn't send the email. Try again.");
    }
  }
  await sql`insert into sign_in_requests (request_id) values (${requestId}) on conflict (request_id) do nothing`;
  return { outcome: "checkEmail" };
}

async function linkMemberId(sql: Sql, tokenHash: string): Promise<string | null> {
  const [link] = await sql<{ memberId: string }[]>`
    select member_id::text as "memberId" from magic_links where token_hash = ${tokenHash}
  `;
  return link?.memberId ?? null;
}

async function replay(
  sql: Sql,
  {
    requestId,
    tokenHash,
    sessionToken,
  }: { requestId: string; tokenHash: string; sessionToken: string | null },
): Promise<RedeemResult | null> {
  const [earlier] = await sql<{ id: string; destination: string | null }[]>`
    select sessions.id::text as id, magic_links.destination
    from sessions
    join magic_links on magic_links.id = sessions.magic_link_id
    join members on members.id = sessions.member_id
    where sessions.request_id = ${requestId}
      and magic_links.token_hash = ${tokenHash}
      and sessions.ended_at is null
      and sessions.last_active_at > now() - interval '30 days'
      and members.active
  `;
  if (earlier === undefined) {
    return null;
  }
  const freshToken = newToken();
  await sql.begin(async (tx) => {
    if (sessionToken !== null) {
      await tx`
        update sessions set ended_at = now()
        where token_hash = ${hashToken(sessionToken)} and id <> ${earlier.id} and ended_at is null
      `;
    }
    await tx`update sessions set token_hash = ${hashToken(freshToken)} where id = ${earlier.id}`;
  });
  return { outcome: "signedIn", destination: earlier.destination ?? "/my-issues", sessionToken: freshToken };
}

function isRequestIdConflict(error: unknown): boolean {
  return (
    error instanceof postgres.PostgresError &&
    error.code === "23505" &&
    error.constraint_name === "sessions_request_id_key"
  );
}

async function redeemUnusedLink(
  sql: Sql,
  {
    requestId,
    tokenHash,
    sessionToken,
  }: { requestId: string; tokenHash: string; sessionToken: string | null },
): Promise<RedeemResult> {
  let signedIn: { destination: string | null; username: string; sessionToken: string } | null;
  try {
    signedIn = await sql.begin(async (tx) => {
      const [link] = await tx<
        { id: string; memberId: string; destination: string | null; username: string }[]
      >`
        update magic_links set used_at = now()
        from members
        where magic_links.member_id = members.id
          and magic_links.token_hash = ${tokenHash}
          and magic_links.used_at is null
          and magic_links.expires_at > now()
          and members.active
        returning magic_links.id::text as id, magic_links.member_id::text as "memberId",
          magic_links.destination, members.username
      `;
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
  sql: Sql,
  input: { token: unknown; requestId: unknown; sessionToken: string | null },
): Promise<RedeemResult> {
  const requestId = validRequestId(input.requestId);
  const tokenHash = hashToken(typeof input.token === "string" ? input.token : "");
  const current = input.sessionToken === null ? null : await validateSession(sql, input.sessionToken);
  if (current !== null && (await linkMemberId(sql, tokenHash)) !== current.id) {
    return { outcome: "signedInAsOther", fullName: current.fullName };
  }
  const sessionToken = current === null ? null : input.sessionToken;
  return (
    (await replay(sql, { requestId, tokenHash, sessionToken })) ??
    redeemUnusedLink(sql, { requestId, tokenHash, sessionToken })
  );
}

export async function landingState(
  sql: Sql,
  { token, member }: { token: string; member: Member | null },
): Promise<LandingState> {
  if (member === null || (await linkMemberId(sql, hashToken(token))) === member.id) {
    return { state: "signIn" };
  }
  return { state: "signedInAsOther", fullName: member.fullName };
}