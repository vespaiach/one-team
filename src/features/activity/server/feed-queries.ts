import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { activity, comment, user } from "@/db/schema";
import { publicUser } from "@/features/auth/server/projections";

export type FeedTarget = { issueId: string } | { projectId: string };

export type ActivityType =
  | "created"
  | "field_changed"
  | "member_added"
  | "member_removed"
  | "archived"
  | "reopened"
  | "comment";

export type FeedCursor = { createdAt: Date; id: string };

export type FeedViewer = { id: string; isAdmin: boolean };

export type PublicUser = {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  role: string;
  jobTitle: string | null;
  deactivatedAt: Date | null;
};

export type FeedRow = {
  id: string;
  kind: "comment" | ActivityType;
  actorId: string;
  actor: PublicUser;
  createdAt: Date;
  body: string | null;
  canEdit: boolean | null;
  canDelete: boolean | null;
  field: string | null;
  fromValue: string | null;
  toValue: string | null;
};

export type FeedPage = { rows: FeedRow[]; hasNextPage: boolean };

const PAGE_SIZE = 50;

export async function listFeed(
  target: FeedTarget,
  viewer: FeedViewer,
  cursor?: FeedCursor,
  limit: number = PAGE_SIZE,
): Promise<FeedPage> {
  const commentTargetClause =
    "issueId" in target ? eq(comment.issueId, target.issueId) : eq(comment.projectId, target.projectId);
  const activityTargetClause =
    "issueId" in target ? eq(activity.issueId, target.issueId) : eq(activity.projectId, target.projectId);

  const commentWhere = cursor
    ? and(
        commentTargetClause,
        sql`(${comment.createdAt}, ${comment.id}) < (${cursor.createdAt.toISOString()}, ${cursor.id})`,
      )
    : commentTargetClause;
  const activityWhere = cursor
    ? and(
        activityTargetClause,
        sql`(${activity.createdAt}, ${activity.id}) < (${cursor.createdAt.toISOString()}, ${cursor.id})`,
      )
    : activityTargetClause;

  const commentSelect = db
    .select({
      id: comment.id,
      kind: sql<string>`'comment'`.as("kind"),
      actorId: comment.authorId,
      createdAt: comment.createdAt,
      body: sql<string | null>`${comment.body}`.as("body"),
      field: sql<string | null>`null`.as("field"),
      fromValue: sql<string | null>`null`.as("from_value"),
      toValue: sql<string | null>`null`.as("to_value"),
    })
    .from(comment)
    .where(commentWhere);

  const activitySelect = db
    .select({
      id: activity.id,
      kind: activity.type,
      actorId: activity.actorId,
      createdAt: activity.createdAt,
      body: sql<string | null>`null`.as("body"),
      field: activity.field,
      fromValue: activity.fromValue,
      toValue: activity.toValue,
    })
    .from(activity)
    .where(activityWhere);

  const feedUnion = commentSelect.unionAll(activitySelect).as("feed");

  const combinedRows = await db
    .select()
    .from(feedUnion)
    .orderBy(desc(feedUnion.createdAt), desc(feedUnion.id))
    .limit(limit + 1);

  const hasNextPage = combinedRows.length > limit;
  const pageRows = hasNextPage ? combinedRows.slice(0, limit) : combinedRows;

  const actorIds = Array.from(new Set(pageRows.map((row) => row.actorId)));
  const actors =
    actorIds.length > 0 ? await db.select(publicUser).from(user).where(inArray(user.id, actorIds)) : [];
  const actorById = new Map(actors.map((actorRow) => [actorRow.id, actorRow]));

  const rows: FeedRow[] = pageRows.map((row) => {
    const actor = actorById.get(row.actorId);
    if (!actor) {
      throw new Error(`listFeed: actor ${row.actorId} not found`);
    }
    const isComment = row.kind === "comment";
    return {
      id: row.id,
      kind: row.kind as FeedRow["kind"],
      actorId: row.actorId,
      actor,
      createdAt: row.createdAt,
      body: isComment ? row.body : null,
      canEdit: isComment ? row.actorId === viewer.id : null,
      canDelete: isComment ? row.actorId === viewer.id || viewer.isAdmin : null,
      field: isComment ? null : row.field,
      fromValue: isComment ? null : row.fromValue,
      toValue: isComment ? null : row.toValue,
    };
  });

  return { rows, hasNextPage };
}