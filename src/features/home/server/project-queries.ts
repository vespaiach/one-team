import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { boardColumn, issue, project, projectMember, user } from "@/db/schema";
import { displayName } from "@/lib/display-name";

export type ProjectCardMember = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

export type ProjectProgressRow = {
  key: string;
  name: string;
  status: "active";
  href: string;
  done: number;
  counted: number;
  openCount: number;
  targetDate: string | null;
  targetPassed: boolean;
  members: ProjectCardMember[];
};

async function membersByProjectId(projectIds: string[]): Promise<Map<string, ProjectCardMember[]>> {
  if (projectIds.length === 0) {
    return new Map();
  }

  const rows = await db
    .select({
      projectId: projectMember.projectId,
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
    })
    .from(projectMember)
    .innerJoin(user, eq(user.id, projectMember.userId))
    .where(inArray(projectMember.projectId, projectIds))
    .orderBy(sql`lower(${user.lastName})`, sql`lower(${user.firstName})`);

  const members = new Map<string, ProjectCardMember[]>();
  for (const row of rows) {
    const entry = members.get(row.projectId) ?? [];
    entry.push({ id: row.id, name: displayName(row), avatarUrl: row.avatarUrl });
    members.set(row.projectId, entry);
  }
  return members;
}

export async function listMemberProjectsWithProgress(userId: string): Promise<ProjectProgressRow[]> {
  const rows = await db
    .select({
      id: project.id,
      key: project.key,
      name: project.name,
      targetDate: project.targetDate,
      targetPassed: sql<boolean>`coalesce(${project.targetDate} < current_date, false)`,
      done: sql<number>`count(*) filter (where ${boardColumn.kind} = 'done')`,
      counted: sql<number>`count(*) filter (where ${boardColumn.kind} <> 'canceled')`,
    })
    .from(projectMember)
    .innerJoin(project, eq(project.id, projectMember.projectId))
    .leftJoin(issue, eq(issue.projectId, project.id))
    .leftJoin(boardColumn, eq(boardColumn.id, issue.columnId))
    .where(and(eq(projectMember.userId, userId), eq(project.status, "active")))
    .groupBy(project.id)
    .orderBy(sql`lower(${project.name})`, asc(project.key));

  const membersByProject = await membersByProjectId(rows.map((row) => row.id));

  return rows.map((row) => {
    const done = Number(row.done);
    const counted = Number(row.counted);
    return {
      key: row.key,
      name: row.name,
      status: "active",
      href: `/projects/${row.key}`,
      done,
      counted,
      openCount: counted - done,
      targetDate: row.targetDate,
      targetPassed: row.targetPassed,
      members: membersByProject.get(row.id) ?? [],
    };
  });
}

export async function hasAnyProject(): Promise<boolean> {
  const [row] = await db.select({ id: project.id }).from(project).limit(1);
  return row !== undefined;
}