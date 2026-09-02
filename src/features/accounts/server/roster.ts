import "server-only";
import { desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { invite, user } from "@/db/schema";
import { accountUser } from "@/features/auth/server/projections";

export type InvitationRow = {
  id: string;
  email: string;
  invitedByName: string;
  sentAt: Date;
  expiresAt: Date;
  isExpired: boolean;
};

export async function listOutstandingInvitations(now: Date = new Date()): Promise<InvitationRow[]> {
  const rows = await db
    .select({
      id: invite.id,
      email: invite.email,
      invitedByFirstName: user.firstName,
      invitedByLastName: user.lastName,
      sentAt: invite.createdAt,
      expiresAt: invite.expiresAt,
    })
    .from(invite)
    .innerJoin(user, eq(invite.invitedBy, user.id))
    .where(isNull(invite.acceptedAt))
    .orderBy(desc(invite.createdAt), desc(invite.id));

  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    invitedByName: `${row.invitedByFirstName} ${row.invitedByLastName}`,
    sentAt: row.sentAt,
    expiresAt: row.expiresAt,
    isExpired: row.expiresAt <= now,
  }));
}

export type AccountRow = {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  avatarUrl: string | null;
  email: string;
  role: string;
  joinedAt: Date;
  isActive: boolean;
  projectCount: number;
};

export type RosterView = {
  rows: AccountRow[];
  activeAdminCount: number;
};

export async function loadRoster(): Promise<RosterView> {
  const rows = await db
    .select({ ...accountUser, createdAt: user.createdAt })
    .from(user)
    .orderBy(
      sql`(${user.deactivatedAt} is not null)`,
      sql`(${user.firstName} || ' ' || ${user.lastName}) collate "C"`,
      user.email,
    );

  const activeAdminCount = rows.filter((row) => row.role === "admin" && row.deactivatedAt === null).length;

  return {
    rows: rows.map((row) => ({
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      displayName: `${row.firstName} ${row.lastName}`,
      avatarUrl: row.avatarUrl,
      email: row.email,
      role: row.role,
      joinedAt: row.createdAt,
      isActive: row.deactivatedAt === null,
      projectCount: 0,
    })),
    activeAdminCount,
  };
}