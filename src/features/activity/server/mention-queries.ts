import "server-only";
import { and, eq, exists, isNull, ne, notExists, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { issue, project, projectMember, user } from "@/db/schema";

export type MentionTarget = { issueId: string } | { projectId: string };

export type MentionCandidate = {
  id: string;
  firstName: string;
  lastName: string;
};

export type MentionCandidateGroups = {
  scoped: MentionCandidate[];
  everyoneElse: MentionCandidate[];
};

const candidateColumns = {
  id: user.id,
  firstName: user.firstName,
  lastName: user.lastName,
};

async function resolveTargetProjectId(target: MentionTarget): Promise<string | null> {
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

export async function listMentionCandidates(target: MentionTarget): Promise<MentionCandidateGroups> {
  const projectId = await resolveTargetProjectId(target);

  const membershipSubquery = (id: string) =>
    db
      .select({ one: sql`1` })
      .from(projectMember)
      .where(and(eq(projectMember.projectId, id), eq(projectMember.userId, user.id)));

  const scopedCondition = projectId
    ? or(eq(user.role, "admin"), exists(membershipSubquery(projectId)))
    : eq(user.role, "admin");
  const everyoneElseCondition = projectId
    ? and(ne(user.role, "admin"), notExists(membershipSubquery(projectId)))
    : ne(user.role, "admin");

  const ordering = [sql`lower(${user.lastName})`, sql`lower(${user.firstName})`];

  const scoped = await db
    .select(candidateColumns)
    .from(user)
    .where(and(isNull(user.deactivatedAt), scopedCondition))
    .orderBy(...ordering);

  const everyoneElse = await db
    .select(candidateColumns)
    .from(user)
    .where(and(isNull(user.deactivatedAt), everyoneElseCondition))
    .orderBy(...ordering);

  return { scoped, everyoneElse };
}