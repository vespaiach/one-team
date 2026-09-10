import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { boardColumn, issue, project, projectMember } from "@/db/schema";

export type ProjectProgressRow = {
  key: string;
  name: string;
  status: "active";
  href: string;
  done: number;
  counted: number;
  targetDate: string | null;
};

export async function listMemberProjectsWithProgress(userId: string): Promise<ProjectProgressRow[]> {
  const rows = await db
    .select({
      key: project.key,
      name: project.name,
      targetDate: project.targetDate,
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

  return rows.map((row) => ({
    key: row.key,
    name: row.name,
    status: "active",
    href: `/projects/${row.key}`,
    done: Number(row.done),
    counted: Number(row.counted),
    targetDate: row.targetDate,
  }));
}