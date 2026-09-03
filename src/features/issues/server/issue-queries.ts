import "server-only";
import { and, asc, eq, exists, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { boardColumn, issue, project, projectMember, user } from "@/db/schema";
import type { Actor } from "@/features/auth/server/actor";
import { publicUser } from "@/features/auth/server/projections";
import { isAdmin, isMember } from "@/features/projects/server/authorization";
import { formatIssueKey } from "../issue-key";
import type { IssuePriority } from "./input";

export type IssueColumnOption = {
  id: string;
  name: string;
};

export async function listProjectColumns(projectId: string): Promise<IssueColumnOption[]> {
  return db
    .select({ id: boardColumn.id, name: boardColumn.name })
    .from(boardColumn)
    .where(eq(boardColumn.projectId, projectId))
    .orderBy(asc(boardColumn.sortOrder));
}

export type AssigneeOption = {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  jobTitle: string | null;
};

export async function listAssigneePool(projectId: string): Promise<AssigneeOption[]> {
  const rows = await db
    .select(publicUser)
    .from(user)
    .where(
      and(
        isNull(user.deactivatedAt),
        or(
          eq(user.role, "admin"),
          exists(
            db
              .select({ one: sql`1` })
              .from(projectMember)
              .where(and(eq(projectMember.projectId, projectId), eq(projectMember.userId, user.id))),
          ),
        ),
      ),
    )
    .orderBy(sql`lower(${user.lastName})`, sql`lower(${user.firstName})`);

  return rows.map((row) => ({
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    avatarUrl: row.avatarUrl,
    jobTitle: row.jobTitle,
  }));
}

export type PublicUser = {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  role: string;
  jobTitle: string | null;
  deactivatedAt: Date | null;
};

export type IssueView = {
  id: string;
  key: string;
  number: number;
  title: string;
  description: string | null;
  column: { id: string; name: string };
  priority: IssuePriority;
  assignee: PublicUser | null;
  dueDate: string | null;
  project: { key: string; name: string };
  createdBy: PublicUser;
  createdAt: Date;
  updatedAt: Date;
};

export async function loadIssueView(projectKey: string, number: number): Promise<IssueView | null> {
  const [row] = await db
    .select({
      id: issue.id,
      number: issue.number,
      title: issue.title,
      description: issue.description,
      priority: issue.priority,
      assigneeId: issue.assigneeId,
      dueDate: issue.dueDate,
      createdBy: issue.createdBy,
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
      columnId: boardColumn.id,
      columnName: boardColumn.name,
      projectKey: project.key,
      projectName: project.name,
    })
    .from(issue)
    .innerJoin(project, eq(issue.projectId, project.id))
    .innerJoin(boardColumn, eq(issue.columnId, boardColumn.id))
    .where(and(eq(project.key, projectKey), eq(issue.number, number)));

  if (!row) {
    return null;
  }

  const userIds = row.assigneeId ? [row.createdBy, row.assigneeId] : [row.createdBy];
  const users = await db.select(publicUser).from(user).where(inArray(user.id, userIds));

  const createdBy = users.find((candidate) => candidate.id === row.createdBy);
  if (!createdBy) {
    throw new Error(`loadIssueView: creator ${row.createdBy} not found`);
  }
  const assignee = row.assigneeId
    ? (users.find((candidate) => candidate.id === row.assigneeId) ?? null)
    : null;

  return {
    id: row.id,
    key: formatIssueKey(row.projectKey, row.number),
    number: row.number,
    title: row.title,
    description: row.description,
    column: { id: row.columnId, name: row.columnName },
    priority: row.priority as IssuePriority,
    assignee,
    dueDate: row.dueDate,
    project: { key: row.projectKey, name: row.projectName },
    createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export type IssueWriteAccess = {
  canWrite: boolean;
  writeReason: string;
};

export function buildIssueWriteReason(action: "create" | "edit", projectName: string): string {
  return `Only project members can ${action} issues in ${projectName}.`;
}

export async function resolveIssueWriteAccess(
  actor: Actor,
  project: { id: string; name: string },
  action: "create" | "edit" = "edit",
): Promise<IssueWriteAccess> {
  const canWrite = await isMember(actor, project.id);
  return { canWrite, writeReason: canWrite ? "" : buildIssueWriteReason(action, project.name) };
}

export type IssueDeleteAccess = {
  canDelete: boolean;
  deleteReason: string;
};

export function buildIssueDeleteReason(projectName: string): string {
  return `Only admins can delete issues in ${projectName}.`;
}

export function resolveIssueDeleteAccess(actor: Actor, project: { name: string }): IssueDeleteAccess {
  const canDelete = isAdmin(actor);
  return { canDelete, deleteReason: canDelete ? "" : buildIssueDeleteReason(project.name) };
}