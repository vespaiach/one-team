import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { issue, notification, project, user } from "@/db/schema";
import { logMailSendFailure, logUnhandledServerError } from "@/features/auth/server/log";
import { displayName } from "@/lib/display-name";
import { sendMail } from "@/lib/mail";

const actor = alias(user, "actor");

type MailFacts = {
  recipientEmail: string;
  actorFirstName: string;
  actorLastName: string;
  type: string;
  emailedAt: Date | null;
  commentId: string | null;
  issueNumber: number | null;
  issueTitle: string | null;
  projectKey: string;
  projectName: string;
};

function composeTargetPath(facts: MailFacts): string {
  if (facts.issueNumber === null) {
    return `/projects/${facts.projectKey}/details`;
  }
  return `/projects/${facts.projectKey}/issues/${facts.issueNumber}/details`;
}

function composeLink(facts: MailFacts): string {
  const path = composeTargetPath(facts);
  const fragment = facts.commentId === null ? "" : `#comment-${facts.commentId}`;
  return new URL(`${path}${fragment}`, process.env.APP_URL).toString();
}

function composeTargetLabel(facts: MailFacts): string {
  if (facts.issueNumber === null || facts.issueTitle === null) {
    return facts.projectName;
  }
  return `${facts.projectKey}-${facts.issueNumber} · ${facts.issueTitle}`;
}

function composeSubject(facts: MailFacts): string {
  const actorName = displayName({ firstName: facts.actorFirstName, lastName: facts.actorLastName });
  const target = composeTargetLabel(facts);
  if (facts.type === "mention") {
    return `${actorName} mentioned you in ${target}`;
  }
  if (facts.type === "assignment") {
    return `${actorName} assigned you ${target}`;
  }
  return `${actorName} commented on ${target}`;
}

async function loadMailFacts(notificationId: string): Promise<MailFacts | undefined> {
  const [row] = await db
    .select({
      recipientEmail: user.email,
      actorFirstName: actor.firstName,
      actorLastName: actor.lastName,
      type: notification.type,
      emailedAt: notification.emailedAt,
      commentId: notification.commentId,
      issueNumber: issue.number,
      issueTitle: issue.title,
      projectKey: sql<string>`${project.key}`,
      projectName: sql<string>`${project.name}`,
    })
    .from(notification)
    .innerJoin(user, eq(user.id, notification.userId))
    .innerJoin(actor, eq(actor.id, notification.actorId))
    .leftJoin(issue, eq(issue.id, notification.issueId))
    .leftJoin(project, sql`${project.id} = coalesce(${notification.projectId}, ${issue.projectId})`)
    .where(eq(notification.id, notificationId));

  return row;
}

export async function sendNotificationMail(notificationId: string): Promise<void> {
  const facts = await loadMailFacts(notificationId);
  if (!facts || facts.emailedAt !== null) {
    return;
  }

  const subject = composeSubject(facts);
  const outcome = await sendMail({
    to: facts.recipientEmail,
    subject,
    text: `${subject}\n\n${composeLink(facts)}\n`,
  });

  const now = new Date();
  const unsent = and(eq(notification.id, notificationId), isNull(notification.emailedAt));

  if (outcome === "sent") {
    await db
      .update(notification)
      .set({
        emailedAt: now,
        sendAttempts: sql`${notification.sendAttempts} + 1`,
        updatedAt: now,
      })
      .where(unsent);
    return;
  }

  await db
    .update(notification)
    .set({ sendAttempts: sql`${notification.sendAttempts} + 1`, updatedAt: now })
    .where(unsent);
  logMailSendFailure(facts.recipientEmail);
}

export function dispatchNotificationMail(notificationIds: string[]): void {
  for (const notificationId of notificationIds) {
    sendNotificationMail(notificationId).catch(() => {
      logUnhandledServerError("notification_mail");
    });
  }
}