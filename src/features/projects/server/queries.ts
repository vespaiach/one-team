import "server-only";
import { and, eq, isNull, ne, notExists, sql } from "drizzle-orm";
import { db } from "@/db";
import { project, projectMember, user } from "@/db/schema";
import { publicUser } from "@/features/auth/server/projections";

export async function hasProjectMemberRow(projectId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ projectId: projectMember.projectId })
    .from(projectMember)
    .where(and(eq(projectMember.projectId, projectId), eq(projectMember.userId, userId)));
  return row !== undefined;
}

export async function loadProjectByKey(key: string): Promise<typeof project.$inferSelect | null> {
  const [row] = await db.select().from(project).where(eq(project.key, key));
  return row ?? null;
}

export async function findProjectKeyHolder(key: string): Promise<{ key: string; name: string } | null> {
  const [row] = await db
    .select({ key: project.key, name: project.name })
    .from(project)
    .where(eq(project.key, key));
  return row ?? null;
}

export type RosterEntry = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  jobTitle: string | null;
  deactivated: boolean;
};

export async function listAddableUsers(params: {
  excludeProjectId?: string;
  excludeUserId?: string;
}): Promise<RosterEntry[]> {
  const conditions = [isNull(user.deactivatedAt)];
  if (params.excludeUserId) {
    conditions.push(ne(user.id, params.excludeUserId));
  }
  if (params.excludeProjectId) {
    const projectId = params.excludeProjectId;
    conditions.push(
      notExists(
        db
          .select({ one: sql`1` })
          .from(projectMember)
          .where(and(eq(projectMember.projectId, projectId), eq(projectMember.userId, user.id))),
      ),
    );
  }

  const rows = await db
    .select(publicUser)
    .from(user)
    .where(and(...conditions))
    .orderBy(sql`lower(${user.lastName})`, sql`lower(${user.firstName})`);

  return rows.map((row) => ({
    userId: row.id,
    displayName: `${row.firstName} ${row.lastName}`,
    avatarUrl: row.avatarUrl,
    jobTitle: row.jobTitle,
    deactivated: false,
  }));
}