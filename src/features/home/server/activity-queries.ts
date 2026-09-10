import "server-only";
import { desc, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { activity, comment, issue, project, user } from "@/db/schema";
import type { ActivityType } from "@/features/activity/server/write-activity";
import { publicUser } from "@/features/auth/server/projections";
import { formatIssueKey } from "@/features/issues/issue-key";

type ActivityActor = {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  role: string;
  jobTitle: string | null;
  deactivatedAt: Date | null;
};

export type InstallationActivityRow = {
  id: string;
  kind: "comment" | ActivityType;
  actor: ActivityActor;
  targetLabel: string;
  projectName: string;
  href: string;
  createdAt: Date;
  field: string | null;
  fromValue: string | null;
  toValue: string | null;
  body: string | null;
};

type ResolvedTarget = { targetLabel: string; projectName: string; href: string };

const INSTALLATION_ACTIVITY_LIMIT = 20;

async function resolveTargets(
  issueIds: string[],
  projectIds: string[],
): Promise<Map<string, ResolvedTarget>> {
  const issueTargets =
    issueIds.length > 0
      ? await db
          .select({
            id: issue.id,
            number: issue.number,
            title: issue.title,
            projectKey: project.key,
            projectName: project.name,
          })
          .from(issue)
          .innerJoin(project, eq(project.id, issue.projectId))
          .where(inArray(issue.id, issueIds))
      : [];

  const projectTargets =
    projectIds.length > 0
      ? await db
          .select({ id: project.id, key: project.key, name: project.name })
          .from(project)
          .where(inArray(project.id, projectIds))
      : [];

  const targetById = new Map<string, ResolvedTarget>();
  for (const target of issueTargets) {
    targetById.set(target.id, {
      targetLabel: `${formatIssueKey(target.projectKey, target.number)} · ${target.title}`,
      projectName: target.projectName,
      href: `/projects/${target.projectKey}/issues/${target.number}/details`,
    });
  }
  for (const target of projectTargets) {
    targetById.set(target.id, {
      targetLabel: target.name,
      projectName: target.name,
      href: `/projects/${target.key}`,
    });
  }
  return targetById;
}

export async function listInstallationActivity(): Promise<InstallationActivityRow[]> {
  const commentSelect = db
    .select({
      id: comment.id,
      kind: sql<string>`'comment'`.as("kind"),
      actorId: comment.authorId,
      issueId: comment.issueId,
      projectId: comment.projectId,
      createdAt: comment.createdAt,
      field: sql<string | null>`null`.as("field"),
      fromValue: sql<string | null>`null`.as("from_value"),
      toValue: sql<string | null>`null`.as("to_value"),
      body: sql<string | null>`${comment.body}`.as("body"),
    })
    .from(comment);

  const activitySelect = db
    .select({
      id: activity.id,
      kind: activity.type,
      actorId: activity.actorId,
      issueId: activity.issueId,
      projectId: activity.projectId,
      createdAt: activity.createdAt,
      field: activity.field,
      fromValue: activity.fromValue,
      toValue: activity.toValue,
      body: sql<string | null>`null`.as("body"),
    })
    .from(activity)
    .where(ne(activity.type, "comment"));

  const installationFeed = commentSelect.unionAll(activitySelect).as("installation_feed");

  const unionRows = await db
    .select()
    .from(installationFeed)
    .orderBy(desc(installationFeed.createdAt), desc(installationFeed.id))
    .limit(INSTALLATION_ACTIVITY_LIMIT);

  const actorIds = Array.from(new Set(unionRows.map((row) => row.actorId)));
  const actors =
    actorIds.length > 0 ? await db.select(publicUser).from(user).where(inArray(user.id, actorIds)) : [];
  const actorById = new Map(actors.map((actorRow) => [actorRow.id, actorRow]));

  const targetById = await resolveTargets(
    Array.from(new Set(unionRows.flatMap((row) => (row.issueId === null ? [] : [row.issueId])))),
    Array.from(new Set(unionRows.flatMap((row) => (row.projectId === null ? [] : [row.projectId])))),
  );

  return unionRows.map((row) => {
    const actor = actorById.get(row.actorId);
    if (!actor) {
      throw new Error(`listInstallationActivity: actor ${row.actorId} not found`);
    }
    const targetId = row.issueId ?? row.projectId;
    const target = targetId === null ? undefined : targetById.get(targetId);
    if (!target) {
      throw new Error(`listInstallationActivity: target for row ${row.id} not found`);
    }
    return {
      id: row.id,
      kind: row.kind as InstallationActivityRow["kind"],
      actor,
      targetLabel: target.targetLabel,
      projectName: target.projectName,
      href: target.href,
      createdAt: row.createdAt,
      field: row.field,
      fromValue: row.fromValue,
      toValue: row.toValue,
      body: row.body,
    };
  });
}