import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { invite } from "@/db/schema";
import { digestToken, issueToken } from "@/features/auth/server/crypto";
import { classifyToken } from "@/features/auth/server/token-state";

const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

export type InvitationRecord = typeof invite.$inferSelect;
export type InvitationState = "valid" | "used" | "expired" | "unknown";
export type InvitationResolution =
  | { state: "unknown"; invitation: null }
  | { state: Exclude<InvitationState, "unknown">; invitation: InvitationRecord };

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbOrTransaction = typeof db | Transaction;

export async function issueInvitation(params: {
  email: string;
  invitedBy: string;
  now?: Date;
}): Promise<{ token: string; invitation: InvitationRecord }> {
  const now = params.now ?? new Date();
  const { token, digest } = issueToken();

  const [row] = await db
    .insert(invite)
    .values({
      email: params.email,
      invitedBy: params.invitedBy,
      tokenDigest: digest,
      expiresAt: new Date(now.getTime() + INVITATION_LIFETIME_MS),
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (!row) {
    throw new Error("issueInvitation produced no row");
  }

  return { token, invitation: row };
}

export async function resendInvitation(
  invitationId: string,
  now: Date = new Date(),
): Promise<{ token: string; invitation: InvitationRecord } | null> {
  const { token, digest } = issueToken();

  const [row] = await db
    .update(invite)
    .set({
      tokenDigest: digest,
      expiresAt: new Date(now.getTime() + INVITATION_LIFETIME_MS),
      updatedAt: now,
    })
    .where(and(eq(invite.id, invitationId), isNull(invite.acceptedAt)))
    .returning();

  if (!row) {
    return null;
  }

  return { token, invitation: row };
}

export async function revokeInvitation(invitationId: string): Promise<boolean> {
  const rows = await db
    .delete(invite)
    .where(and(eq(invite.id, invitationId), isNull(invite.acceptedAt)))
    .returning();

  return rows.length > 0;
}

export async function resolveInvitationState(
  token: string,
  now: Date = new Date(),
): Promise<InvitationResolution> {
  const digest = digestToken(token);

  const [row] = await db.select().from(invite).where(eq(invite.tokenDigest, digest));

  if (!row) {
    return { state: "unknown", invitation: null };
  }
  return {
    state: classifyToken({ spentAt: row.acceptedAt, expiresAt: row.expiresAt }, now),
    invitation: row,
  };
}

export async function spendInvitation(
  executor: DbOrTransaction,
  invitationId: string,
  now: Date = new Date(),
): Promise<InvitationRecord | null> {
  const [row] = await executor
    .update(invite)
    .set({ acceptedAt: now })
    .where(and(eq(invite.id, invitationId), isNull(invite.acceptedAt)))
    .returning();

  return row ?? null;
}