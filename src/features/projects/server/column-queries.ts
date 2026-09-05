import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { boardColumn, issue } from "@/db/schema";

type ColumnCountExecutor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function findColumnProjectId(columnId: string): Promise<string | null> {
  const [row] = await db
    .select({ projectId: boardColumn.projectId })
    .from(boardColumn)
    .where(eq(boardColumn.id, columnId));
  return row?.projectId ?? null;
}

export async function countIssuesByColumn(
  executor: ColumnCountExecutor,
  projectId: string,
): Promise<Map<string, number>> {
  const rows = await executor
    .select({ columnId: issue.columnId, issueCount: sql<number>`count(*)::int` })
    .from(issue)
    .where(eq(issue.projectId, projectId))
    .groupBy(issue.columnId);

  return new Map(rows.map((row) => [row.columnId, row.issueCount]));
}