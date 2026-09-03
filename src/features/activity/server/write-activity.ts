import "server-only";
import type { db } from "@/db";
import { activity } from "@/db/schema";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type ActivityTarget = { issueId: string } | { projectId: string };

export type ActivityType =
  | "created"
  | "field_changed"
  | "member_added"
  | "member_removed"
  | "archived"
  | "reopened"
  | "comment";

export type WriteActivityInput = {
  type: ActivityType;
  target: ActivityTarget;
  actorId: string;
  field?: string;
  fromValue?: string | null;
  toValue?: string | null;
  commentId?: string;
};

export async function writeActivity(tx: Transaction, input: WriteActivityInput): Promise<void> {
  await tx.insert(activity).values({
    actorId: input.actorId,
    type: input.type,
    issueId: "issueId" in input.target ? input.target.issueId : null,
    projectId: "projectId" in input.target ? input.target.projectId : null,
    field: input.field ?? null,
    fromValue: input.fromValue ?? null,
    toValue: input.toValue ?? null,
    commentId: input.commentId ?? null,
    createdAt: new Date(),
  });
}