import "server-only";
import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import type { db } from "@/db";
import { issue, notification, projectMember, user } from "@/db/schema";
import { MENTION_TOKEN_PATTERN } from "@/features/activity/server/mention-resolve";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type NotificationTarget = { issueId: string } | { projectId: string };

export type WriteAssignmentNotificationsInput = {
  issueId: string;
  assigneeId: string | null;
  actorId: string;
};

export type WriteCommentNotificationsInput = {
  commentId: string;
  target: NotificationTarget;
  actorId: string;
  body: string;
};

export type WriteMentionDiffNotificationsInput = {
  commentId: string;
  target: NotificationTarget;
  actorId: string;
  previousBody: string;
  nextBody: string;
};

function mentionedIds(body: string): string[] {
  return Array.from(body.matchAll(MENTION_TOKEN_PATTERN), (match) => match[1]);
}

async function eligibleRecipients(
  tx: Transaction,
  candidateIds: string[],
  actorId: string,
): Promise<string[]> {
  const candidates = Array.from(new Set(candidateIds));
  if (candidates.length === 0) {
    return [];
  }

  const rows = await tx
    .select({ id: user.id })
    .from(user)
    .where(and(inArray(user.id, candidates), isNull(user.deactivatedAt), ne(user.id, actorId)));

  return rows.map((row) => row.id);
}

async function commentListeners(tx: Transaction, target: NotificationTarget): Promise<string[]> {
  if ("issueId" in target) {
    const [row] = await tx
      .select({ assigneeId: issue.assigneeId, createdBy: issue.createdBy })
      .from(issue)
      .where(eq(issue.id, target.issueId));
    if (!row) {
      return [];
    }
    return [row.assigneeId, row.createdBy].filter((id): id is string => id !== null);
  }

  const rows = await tx
    .select({ userId: projectMember.userId })
    .from(projectMember)
    .where(eq(projectMember.projectId, target.projectId));

  return rows.map((row) => row.userId);
}

export async function writeAssignmentNotifications(
  tx: Transaction,
  params: WriteAssignmentNotificationsInput,
): Promise<string[]> {
  if (params.assigneeId === null) {
    return [];
  }

  const [recipientId] = await eligibleRecipients(tx, [params.assigneeId], params.actorId);
  if (recipientId === undefined) {
    return [];
  }

  const now = new Date();
  const inserted = await tx
    .insert(notification)
    .values({
      userId: recipientId,
      actorId: params.actorId,
      type: "assignment",
      issueId: params.issueId,
      projectId: null,
      commentId: null,
      sendAttempts: 0,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: notification.id });

  return inserted.map((row) => row.id);
}

export async function writeCommentNotifications(
  tx: Transaction,
  params: WriteCommentNotificationsInput,
): Promise<string[]> {
  const mentioned = await eligibleRecipients(tx, mentionedIds(params.body), params.actorId);
  const mentionedSet = new Set(mentioned);

  const listeners = await eligibleRecipients(tx, await commentListeners(tx, params.target), params.actorId);
  const commented = listeners.filter((id) => !mentionedSet.has(id));

  const now = new Date();
  const rows = [
    ...mentioned.map((userId) => ({ userId, type: "mention" })),
    ...commented.map((userId) => ({ userId, type: "comment" })),
  ].map(({ userId, type }) => ({
    userId,
    actorId: params.actorId,
    type,
    issueId: "issueId" in params.target ? params.target.issueId : null,
    projectId: "projectId" in params.target ? params.target.projectId : null,
    commentId: params.commentId,
    sendAttempts: 0,
    createdAt: now,
    updatedAt: now,
  }));

  if (rows.length === 0) {
    return [];
  }

  const inserted = await tx
    .insert(notification)
    .values(rows)
    .onConflictDoNothing()
    .returning({ id: notification.id });

  return inserted.map((row) => row.id);
}

export async function writeMentionDiffNotifications(
  tx: Transaction,
  params: WriteMentionDiffNotificationsInput,
): Promise<string[]> {
  const previouslyNamed = new Set(mentionedIds(params.previousBody));
  const newlyNamed = mentionedIds(params.nextBody).filter((id) => !previouslyNamed.has(id));
  const recipients = await eligibleRecipients(tx, newlyNamed, params.actorId);
  if (recipients.length === 0) {
    return [];
  }

  const now = new Date();
  const inserted = await tx
    .insert(notification)
    .values(
      recipients.map((userId) => ({
        userId,
        actorId: params.actorId,
        type: "mention",
        issueId: "issueId" in params.target ? params.target.issueId : null,
        projectId: "projectId" in params.target ? params.target.projectId : null,
        commentId: params.commentId,
        sendAttempts: 0,
        createdAt: now,
        updatedAt: now,
      })),
    )
    .onConflictDoNothing()
    .returning({ id: notification.id });

  return inserted.map((row) => row.id);
}