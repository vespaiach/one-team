import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Sql, TransactionSql } from "postgres";
import { cache } from "react";
import { db } from "./db.ts";
import type { Member } from "./members.ts";
import { hashToken, newToken } from "./tokens.ts";

const cookieName = "session";

function cookieAttributes(maxAge: number): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`;
}

export function sessionCookie(token: string): string {
  return `${cookieName}=${token}; ${cookieAttributes(34560000)}`;
}

export function clearSessionCookie(): string {
  return `${cookieName}=; ${cookieAttributes(0)}`;
}

export function readSessionToken(request: Request): string | null {
  const header = request.headers.get("cookie");
  if (header === null) {
    return null;
  }
  for (const pair of header.split(";")) {
    const [name, ...value] = pair.trim().split("=");
    if (name === cookieName) {
      return value.join("=");
    }
  }
  return null;
}

export async function validateSession(sql: Sql, token: string): Promise<Member | null> {
  const [member] = await sql<Member[]>`
    update sessions set last_active_at = now()
    from members
    where sessions.member_id = members.id
      and sessions.token_hash = ${hashToken(token)}
      and sessions.ended_at is null
      and sessions.last_active_at > now() - interval '30 days'
      and members.active
    returning members.id::text as id, members.full_name as "fullName", members.username, members.role
  `;
  return member ?? null;
}

export async function startSession(
  sql: Sql | TransactionSql,
  { memberId, magicLinkId, requestId }: { memberId: string; magicLinkId: string; requestId: string },
): Promise<string> {
  const token = newToken();
  await sql`
    insert into sessions (member_id, token_hash, magic_link_id, request_id)
    values (${memberId}, ${hashToken(token)}, ${magicLinkId}, ${requestId})
  `;
  return token;
}

export async function endSession(sql: Sql | TransactionSql, token: string): Promise<void> {
  await sql`
    update sessions set ended_at = now()
    where token_hash = ${hashToken(token)} and ended_at is null
  `;
}

export const currentMember = cache(async (): Promise<Member | null> => {
  const token = (await cookies()).get(cookieName)?.value;
  if (token === undefined) {
    return null;
  }
  return validateSession(db(), token);
});

export async function requireCurrentMember(): Promise<Member> {
  const member = await currentMember();
  if (member === null) {
    redirect("/sign-in");
  }
  return member;
}