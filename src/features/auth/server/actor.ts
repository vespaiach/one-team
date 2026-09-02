import "server-only";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { session, user } from "@/db/schema";
import { digestToken } from "./crypto";
import { SESSION_COOKIE_NAME, SESSION_LIFETIME_MS } from "./sessions";

export type Actor = {
  id: string;
  role: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  mustChangePassword: boolean;
};

async function loadActorImpl(): Promise<Actor | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  const digest = digestToken(token);
  const now = new Date();

  const [row] = await db
    .select({
      sessionId: session.id,
      userId: user.id,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      mustChangePassword: user.mustChangePassword,
      deactivatedAt: user.deactivatedAt,
    })
    .from(session)
    .innerJoin(user, eq(session.userId, user.id))
    .where(and(eq(session.tokenDigest, digest), gt(session.expiresAt, now)));

  if (!row || row.deactivatedAt) {
    return null;
  }

  await db
    .update(session)
    .set({ lastSeenAt: now, expiresAt: new Date(now.getTime() + SESSION_LIFETIME_MS) })
    .where(eq(session.id, row.sessionId));

  return {
    id: row.userId,
    role: row.role,
    firstName: row.firstName,
    lastName: row.lastName,
    avatarUrl: row.avatarUrl,
    mustChangePassword: row.mustChangePassword,
  };
}

export const loadActor = cache(loadActorImpl);

export async function requireActor(): Promise<Actor> {
  const actor = await loadActor();
  if (!actor) {
    redirect("/signin");
  }
  return actor;
}