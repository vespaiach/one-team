import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import { boardColumn, issue, issueLabel, label, project } from "@/db/schema";
import { formatIssueKey } from "@/features/issues/issue-key";
import type { IssuePriority } from "@/features/issues/server/input";
import type { ColumnMeta } from "../group-by-column";

export type AssignedIssueRow = {
  id: string;
  key: string;
  title: string;
  projectKey: string;
  projectName: string;
  href: string;
  dueThisWeek: boolean;
  priority: IssuePriority;
  dueDate: string | null;
  label: string | null;
  column: ColumnMeta;
};

async function firstLabelByIssue(issueIds: string[]): Promise<Map<string, string>> {
  if (issueIds.length === 0) {
    return new Map();
  }

  const rows = await db
    .select({ issueId: issueLabel.issueId, name: label.name })
    .from(issueLabel)
    .innerJoin(label, eq(label.id, issueLabel.labelId))
    .where(inArray(issueLabel.issueId, issueIds))
    .orderBy(sql`lower(${label.name})`);

  const firstLabelByIssueId = new Map<string, string>();
  for (const row of rows) {
    if (!firstLabelByIssueId.has(row.issueId)) {
      firstLabelByIssueId.set(row.issueId, row.name);
    }
  }
  return firstLabelByIssueId;
}

async function listAssignedIssuesImpl(userId: string): Promise<AssignedIssueRow[]> {
  const rows = await db
    .select({
      id: issue.id,
      number: issue.number,
      title: issue.title,
      projectKey: project.key,
      projectName: project.name,
      priority: issue.priority,
      dueDate: issue.dueDate,
      dueThisWeek: sql<boolean>`coalesce(${issue.dueDate} between current_date and current_date + 6, false)`,
      columnId: boardColumn.id,
      columnName: boardColumn.name,
      columnKind: boardColumn.kind,
      columnSortOrder: boardColumn.sortOrder,
    })
    .from(issue)
    .innerJoin(project, eq(project.id, issue.projectId))
    .innerJoin(boardColumn, eq(boardColumn.id, issue.columnId))
    .where(and(eq(issue.assigneeId, userId), eq(boardColumn.kind, "open")))
    .orderBy(asc(boardColumn.sortOrder), desc(issue.createdAt), desc(issue.id));

  const labelByIssueId = await firstLabelByIssue(rows.map((row) => row.id));

  return rows.map((row) => ({
    id: row.id,
    key: formatIssueKey(row.projectKey, row.number),
    title: row.title,
    projectKey: row.projectKey,
    projectName: row.projectName,
    href: `/projects/${row.projectKey}/issues/${row.number}/details`,
    dueThisWeek: row.dueThisWeek,
    priority: row.priority as IssuePriority,
    dueDate: row.dueDate,
    label: labelByIssueId.get(row.id) ?? null,
    column: {
      id: row.columnId,
      name: row.columnName,
      kind: row.columnKind as ColumnMeta["kind"],
      sortOrder: row.columnSortOrder,
    },
  }));
}

export const listAssignedIssues = cache(listAssignedIssuesImpl);