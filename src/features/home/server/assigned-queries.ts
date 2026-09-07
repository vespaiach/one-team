import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import { issue, project } from "@/db/schema";
import { formatIssueKey } from "@/features/issues/issue-key";

export type AssignedIssueRow = {
  id: string;
  key: string;
  title: string;
  projectName: string;
  href: string;
  dueThisWeek: boolean;
};

async function listAssignedIssuesImpl(userId: string): Promise<AssignedIssueRow[]> {
  const rows = await db
    .select({
      id: issue.id,
      number: issue.number,
      title: issue.title,
      projectKey: project.key,
      projectName: project.name,
      dueThisWeek: sql<boolean>`coalesce(${issue.dueDate} between current_date and current_date + 6, false)`,
    })
    .from(issue)
    .innerJoin(project, eq(project.id, issue.projectId))
    .where(eq(issue.assigneeId, userId))
    .orderBy(desc(issue.createdAt), desc(issue.id));

  return rows.map((row) => ({
    id: row.id,
    key: formatIssueKey(row.projectKey, row.number),
    title: row.title,
    projectName: row.projectName,
    href: `/projects/${row.projectKey}/issues/${row.number}/details`,
    dueThisWeek: row.dueThisWeek,
  }));
}

export const listAssignedIssues = cache(listAssignedIssuesImpl);