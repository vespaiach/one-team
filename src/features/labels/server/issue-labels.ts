import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { issue, issueLabel, label, project } from "@/db/schema";
import type { Actor } from "@/features/auth/server/actor";
import { isMember } from "@/features/projects/server/authorization";

export type IssueLabelInput = {
  actor: Actor;
  issueId: string;
  labelId: string;
};

export type IssueLabelResult =
  | { ok: true; applied: boolean }
  | { ok: false; error: "forbidden"; reason: string }
  | { ok: false; error: "not_found" }
  | { ok: false; error: "label_not_found" };

async function loadProjectForIssue(issueId: string) {
  const [issueRow] = await db.select({ projectId: issue.projectId }).from(issue).where(eq(issue.id, issueId));
  if (!issueRow) {
    return null;
  }
  const [projectRow] = await db.select().from(project).where(eq(project.id, issueRow.projectId));
  return projectRow ?? null;
}

async function authorize(input: IssueLabelInput): Promise<IssueLabelResult | { projectId: string }> {
  const projectRow = await loadProjectForIssue(input.issueId);
  if (!projectRow) {
    return { ok: false, error: "not_found" };
  }
  if (!(await isMember(input.actor, projectRow.id))) {
    return {
      ok: false,
      error: "forbidden",
      reason: `Only project members can change labels in ${projectRow.name}.`,
    };
  }
  return { projectId: projectRow.id };
}

function isRefusal(result: IssueLabelResult | { projectId: string }): result is IssueLabelResult {
  return "ok" in result;
}

export async function addIssueLabel(input: IssueLabelInput): Promise<IssueLabelResult> {
  const authorized = await authorize(input);
  if (isRefusal(authorized)) {
    return authorized;
  }

  const [labelRow] = await db.select({ id: label.id }).from(label).where(eq(label.id, input.labelId));
  if (!labelRow) {
    return { ok: false, error: "label_not_found" };
  }

  await db.transaction(async (tx) => {
    await tx
      .insert(issueLabel)
      .values({ issueId: input.issueId, labelId: input.labelId })
      .onConflictDoNothing();
  });

  return { ok: true, applied: true };
}

export async function removeIssueLabel(input: IssueLabelInput): Promise<IssueLabelResult> {
  const authorized = await authorize(input);
  if (isRefusal(authorized)) {
    return authorized;
  }

  const [labelRow] = await db.select({ id: label.id }).from(label).where(eq(label.id, input.labelId));
  if (!labelRow) {
    return { ok: false, error: "label_not_found" };
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(issueLabel)
      .where(and(eq(issueLabel.issueId, input.issueId), eq(issueLabel.labelId, input.labelId)));
  });

  return { ok: true, applied: false };
}