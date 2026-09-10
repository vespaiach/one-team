import "server-only";
import { and, asc, eq, exists, isNotNull, ne, notExists, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { boardColumn, comment, issue, issueLabel, label, projectMember, user } from "@/db/schema";
import type { Actor } from "@/features/auth/server/actor";
import { formatIssueKey } from "@/features/issues/issue-key";
import type { IssuePriority } from "@/features/issues/server/input";
import { listAssigneePool, resolveIssueWriteAccess } from "@/features/issues/server/issue-queries";
import { isAdmin } from "@/features/projects/server/authorization";
import { loadProjectByKey } from "@/features/projects/server/queries";

export type BoardPerson = {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
};

export type BoardCard = {
  id: string;
  key: string;
  number: number;
  title: string;
  columnId: string;
  assigneeId: string | null;
  priority: IssuePriority;
  dueDate: string | null;
  labels: { id: string; name: string }[];
  assignee: BoardPerson | null;
  commentCount: number;
  order: number;
};

export type ColumnKind = "open" | "done" | "canceled";

export type BoardView = {
  project: { id: string; key: string; name: string; status: string };
  columns: { id: string; name: string; kind: ColumnKind }[];
  cards: BoardCard[];
  assigneePool: BoardPerson[];
  assignedOutsidePool: BoardPerson[];
  canWrite: boolean;
  writeReason: string;
  viewer: { id: string; firstName: string; lastName: string; avatarUrl: string | null };
  isAdmin: boolean;
};

const boardPerson = {
  id: user.id,
  firstName: user.firstName,
  lastName: user.lastName,
  avatarUrl: user.avatarUrl,
};

async function listAssignedOutsidePool(projectId: string): Promise<BoardPerson[]> {
  return db
    .select(boardPerson)
    .from(user)
    .where(
      and(
        exists(
          db
            .select({ one: sql`1` })
            .from(issue)
            .where(and(eq(issue.projectId, projectId), eq(issue.assigneeId, user.id))),
        ),
        or(
          isNotNull(user.deactivatedAt),
          and(
            ne(user.role, "admin"),
            notExists(
              db
                .select({ one: sql`1` })
                .from(projectMember)
                .where(and(eq(projectMember.projectId, projectId), eq(projectMember.userId, user.id))),
            ),
          ),
        ),
      ),
    )
    .orderBy(sql`lower(${user.lastName})`, sql`lower(${user.firstName})`);
}

export async function loadBoard(projectKey: string, actor: Actor): Promise<BoardView | null> {
  const projectRow = await loadProjectByKey(projectKey);
  if (!projectRow) {
    return null;
  }

  const columns = await db
    .select({ id: boardColumn.id, name: boardColumn.name, kind: boardColumn.kind })
    .from(boardColumn)
    .where(eq(boardColumn.projectId, projectRow.id))
    .orderBy(asc(boardColumn.sortOrder), asc(boardColumn.id));

  const issueRows = await db
    .select({
      id: issue.id,
      number: issue.number,
      title: issue.title,
      columnId: issue.columnId,
      priority: issue.priority,
      assigneeId: issue.assigneeId,
      dueDate: issue.dueDate,
      assignee: boardPerson,
    })
    .from(issue)
    .leftJoin(user, eq(issue.assigneeId, user.id))
    .where(eq(issue.projectId, projectRow.id))
    .orderBy(asc(issue.sortOrder), asc(issue.id));

  const labelRows = await db
    .select({ issueId: issue.id, id: label.id, name: label.name })
    .from(issueLabel)
    .innerJoin(issue, eq(issueLabel.issueId, issue.id))
    .innerJoin(label, eq(issueLabel.labelId, label.id))
    .where(eq(issue.projectId, projectRow.id));

  const commentCountRows = await db
    .select({ issueId: issue.id, total: sql<number>`count(*)::int` })
    .from(comment)
    .innerJoin(issue, eq(comment.issueId, issue.id))
    .where(eq(issue.projectId, projectRow.id))
    .groupBy(issue.id);

  const pool = await listAssigneePool(projectRow.id);
  const assignedOutsidePool = await listAssignedOutsidePool(projectRow.id);
  const { canWrite, writeReason } = await resolveIssueWriteAccess(actor, projectRow);

  const labelsByIssue = new Map<string, { id: string; name: string }[]>();
  for (const row of labelRows) {
    const entries = labelsByIssue.get(row.issueId) ?? [];
    entries.push({ id: row.id, name: row.name });
    labelsByIssue.set(row.issueId, entries);
  }
  const commentCounts = new Map(commentCountRows.map((row) => [row.issueId, row.total]));

  return {
    project: {
      id: projectRow.id,
      key: projectRow.key,
      name: projectRow.name,
      status: projectRow.status,
    },
    columns: columns.map((column) => ({ ...column, kind: column.kind as ColumnKind })),
    cards: issueRows.map((row, index) => ({
      id: row.id,
      key: formatIssueKey(projectRow.key, row.number),
      number: row.number,
      title: row.title,
      columnId: row.columnId,
      assigneeId: row.assigneeId,
      priority: row.priority as IssuePriority,
      dueDate: row.dueDate,
      labels: labelsByIssue.get(row.id) ?? [],
      assignee: row.assignee?.id ? row.assignee : null,
      commentCount: commentCounts.get(row.id) ?? 0,
      order: index,
    })),
    assigneePool: pool.map((person) => ({
      id: person.id,
      firstName: person.firstName,
      lastName: person.lastName,
      avatarUrl: person.avatarUrl,
    })),
    assignedOutsidePool,
    canWrite,
    writeReason,
    viewer: {
      id: actor.id,
      firstName: actor.firstName,
      lastName: actor.lastName,
      avatarUrl: actor.avatarUrl,
    },
    isAdmin: isAdmin(actor),
  };
}