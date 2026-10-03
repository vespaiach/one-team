import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { cache } from "react";
import { type Database, db, type Executor } from "./db.ts";
import { type Member, memberColumns } from "./members.ts";
import { members, sessions } from "./schema.ts";
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

export async function validateSession(database: Database, token: string): Promise<Member | null> {
  const [member] = await database
    .update(sessions)
    .set({ lastActiveAt: sql`now()` })
    .from(members)
    .where(
      and(
        eq(sessions.memberId, members.id),
        eq(sessions.tokenHash, hashToken(token)),
        isNull(sessions.endedAt),
        gt(sessions.lastActiveAt, sql`now() - interval '30 days'`),
        eq(members.active, true),
      ),
    )
    .returning(memberColumns);
  return member ?? null;
}

export async function startSession(
  database: Executor,
  { memberId, magicLinkId, requestId }: { memberId: number; magicLinkId: number; requestId: string },
): Promise<string> {
  const token = newToken();
  await database.insert(sessions).values({ memberId, tokenHash: hashToken(token), magicLinkId, requestId });
  return token;
}

export async function endSession(database: Executor, token: string): Promise<void> {
  await database
    .update(sessions)
    .set({ endedAt: sql`now()` })
    .where(and(eq(sessions.tokenHash, hashToken(token)), isNull(sessions.endedAt)));
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