import "server-only";
import { and, asc, eq, isNull, ne, notExists, sql } from "drizzle-orm";
import { db } from "@/db";
import { boardColumn, project, projectMember, user } from "@/db/schema";
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

export type ProjectRecord = {
  key: string;
  name: string;
  description: string | null;
  status: "active" | "archived";
  startDate: string | null;
  targetDate: string | null;
};

export type ProjectColumnRow = {
  id: string;
  name: string;
  kind: "open" | "done" | "canceled";
  position: number;
  issueCount: number;
};

export type ProjectDetails = {
  record: ProjectRecord;
  columns: ProjectColumnRow[];
  roster: RosterEntry[];
  cascadeCount: number;
  canEditRecord: boolean;
  canAdminister: boolean;
};

export async function loadProjectDetails(
  key: string,
  actor: { id: string; role: string },
): Promise<ProjectDetails | null> {
  const [row] = await db.select().from(project).where(eq(project.key, key));
  if (!row) {
    return null;
  }

  const columnRows = await db
    .select()
    .from(boardColumn)
    .where(eq(boardColumn.projectId, row.id))
    .orderBy(asc(boardColumn.sortOrder));

  const rosterRows = await db
    .select({ ...publicUser })
    .from(projectMember)
    .innerJoin(user, eq(projectMember.userId, user.id))
    .where(eq(projectMember.projectId, row.id))
    .orderBy(sql`lower(${user.lastName})`, sql`lower(${user.firstName})`);

  const roster: RosterEntry[] = rosterRows.map((member) => ({
    userId: member.id,
    displayName: `${member.firstName} ${member.lastName}`,
    avatarUrl: member.avatarUrl,
    jobTitle: member.jobTitle,
    deactivated: member.deactivatedAt !== null,
  }));

  const isAdmin = actor.role === "admin";

  return {
    record: {
      key: row.key,
      name: row.name,
      description: row.description,
      status: row.status as "active" | "archived",
      startDate: row.startDate,
      targetDate: row.targetDate,
    },
    columns: columnRows.map((column, index) => ({
      id: column.id,
      name: column.name,
      kind: column.kind as "open" | "done" | "canceled",
      position: index,
      issueCount: 0,
    })),
    roster,
    cascadeCount: columnRows.length + rosterRows.length,
    canEditRecord: isAdmin || roster.some((entry) => entry.userId === actor.id),
    canAdminister: isAdmin,
  };
}