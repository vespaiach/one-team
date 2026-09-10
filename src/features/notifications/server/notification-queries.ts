import "server-only";
import { and, count, desc, eq, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { issue, notification, project, user } from "@/db/schema";
import { displayName } from "@/lib/display-name";

export type NotificationType = "mention" | "assignment" | "comment";

export type NotificationListItem = {
  id: string;
  type: NotificationType;
  actorName: string;
  actorAvatarUrl: string | null;
  targetLabel: string;
  href: string;
  isUnread: boolean;
  createdAt: Date;
};

const NOTIFICATION_LIST_LIMIT = 200;

const actor = alias(user, "actor");

type NotificationRowShape = {
  id: string;
  type: string;
  actorFirstName: string;
  actorLastName: string;
  actorAvatarUrl: string | null;
  issueNumber: number | null;
  issueTitle: string | null;
  projectKey: string;
  projectName: string;
  commentId: string | null;
  readAt: Date | null;
  createdAt: Date;
};

function composeTargetPath(row: NotificationRowShape): string {
  if (row.issueNumber === null) {
    return `/projects/${row.projectKey}/details`;
  }
  return `/projects/${row.projectKey}/issues/${row.issueNumber}/details`;
}

function composeHref(row: NotificationRowShape): string {
  const path = composeTargetPath(row);
  return row.commentId === null ? path : `${path}#comment-${row.commentId}`;
}

function composeTargetLabel(row: NotificationRowShape): string {
  if (row.issueNumber === null || row.issueTitle === null) {
    return row.projectName;
  }
  return `${row.projectKey}-${row.issueNumber} · ${row.issueTitle}`;
}

export async function listNotifications(userId: string): Promise<NotificationListItem[]> {
  const rows = await db
    .select({
      id: notification.id,
      type: notification.type,
      actorFirstName: actor.firstName,
      actorLastName: actor.lastName,
      actorAvatarUrl: actor.avatarUrl,
      issueNumber: issue.number,
      issueTitle: issue.title,
      projectKey: sql<string>`${project.key}`,
      projectName: sql<string>`${project.name}`,
      commentId: notification.commentId,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
    })
    .from(notification)
    .innerJoin(actor, eq(actor.id, notification.actorId))
    .leftJoin(issue, eq(issue.id, notification.issueId))
    .leftJoin(project, sql`${project.id} = coalesce(${notification.projectId}, ${issue.projectId})`)
    .where(eq(notification.userId, userId))
    .orderBy(desc(notification.createdAt), desc(notification.id))
    .limit(NOTIFICATION_LIST_LIMIT);

  return rows.map((row) => ({
    id: row.id,
    type: row.type as NotificationType,
    actorName: displayName({ firstName: row.actorFirstName, lastName: row.actorLastName }),
    actorAvatarUrl: row.actorAvatarUrl,
    targetLabel: composeTargetLabel(row),
    href: composeHref(row),
    isUnread: row.readAt === null,
    createdAt: row.createdAt,
  }));
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  const [row] = await db
    .select({ unread: count() })
    .from(notification)
    .where(and(eq(notification.userId, userId), isNull(notification.readAt)));

  return row?.unread ?? 0;
}

export async function listRecentMentions(userId: string, limit: number): Promise<NotificationListItem[]> {
  const rows = await db
    .select({
      id: notification.id,
      type: notification.type,
      actorFirstName: actor.firstName,
      actorLastName: actor.lastName,
      actorAvatarUrl: actor.avatarUrl,
      issueNumber: issue.number,
      issueTitle: issue.title,
      projectKey: sql<string>`${project.key}`,
      projectName: sql<string>`${project.name}`,
      commentId: notification.commentId,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
    })
    .from(notification)
    .innerJoin(actor, eq(actor.id, notification.actorId))
    .leftJoin(issue, eq(issue.id, notification.issueId))
    .leftJoin(project, sql`${project.id} = coalesce(${notification.projectId}, ${issue.projectId})`)
    .where(and(eq(notification.userId, userId), eq(notification.type, "mention")))
    .orderBy(desc(notification.createdAt), desc(notification.id))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    type: row.type as NotificationType,
    actorName: displayName({ firstName: row.actorFirstName, lastName: row.actorLastName }),
    actorAvatarUrl: row.actorAvatarUrl,
    targetLabel: composeTargetLabel(row),
    href: composeHref(row),
    isUnread: row.readAt === null,
    createdAt: row.createdAt,
  }));
}