import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { comment, issue, project, user } from "@/db/schema";
import type { Actor } from "@/features/auth/server/actor";
import { publicUser } from "@/features/auth/server/projections";
import { isMember } from "@/features/projects/server/authorization";
import type { FeedRow } from "./feed-queries";
import { parseCommentBody } from "./input";
import type { ActivityTarget } from "./write-activity";
import { writeActivity } from "./write-activity";

export type CreateCommentField = "body";
export type CreateCommentInvalidReason = "required" | "too-long";

export type CreateCommentInput = {
  target: ActivityTarget;
  actor: Actor;
  body: unknown;
};

export type CreateCommentResult =
  | { status: "ok"; comment: FeedRow }
  | { status: "forbidden"; reason: string }
  | { status: "not-found" }
  | { status: "invalid"; field: CreateCommentField; reason: CreateCommentInvalidReason };

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

async function resolveTargetProjectId(target: ActivityTarget): Promise<string | null> {
  if ("issueId" in target) {
    const [issueRow] = await db
      .select({ projectId: issue.projectId })
      .from(issue)
      .where(eq(issue.id, target.issueId));
    return issueRow?.projectId ?? null;
  }
  const [projectRow] = await db
    .select({ id: project.id })
    .from(project)
    .where(eq(project.id, target.projectId));
  return projectRow?.id ?? null;
}

export async function createComment(input: CreateCommentInput): Promise<CreateCommentResult> {
  const projectId = await resolveTargetProjectId(input.target);
  if (projectId === null) {
    return { status: "not-found" };
  }

  if (!(await isMember(input.actor, projectId))) {
    return { status: "forbidden", reason: "Only project members can comment here." };
  }

  const body = parseCommentBody(input.body);
  if (body === null) {
    return {
      status: "invalid",
      field: "body",
      reason: isNonEmptyString(input.body) ? "too-long" : "required",
    };
  }

  const [actorRow] = await db.select(publicUser).from(user).where(eq(user.id, input.actor.id));
  if (!actorRow) {
    return { status: "not-found" };
  }

  const now = new Date();

  const insertedComment = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(comment)
      .values({ authorId: input.actor.id, body, ...input.target, createdAt: now, updatedAt: now })
      .returning({ id: comment.id });

    if (!row) {
      throw new Error("createComment produced no comment row");
    }

    await writeActivity(tx, {
      type: "comment",
      target: input.target,
      actorId: input.actor.id,
      commentId: row.id,
    });

    return row;
  });

  return {
    status: "ok",
    comment: {
      id: insertedComment.id,
      kind: "comment",
      actorId: input.actor.id,
      actor: actorRow,
      createdAt: now,
      body,
      canEdit: true,
      canDelete: true,
      field: null,
      fromValue: null,
      toValue: null,
    },
  };
}