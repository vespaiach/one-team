import "server-only";
import { and, count, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { issueLabel, label } from "@/db/schema";

export type LabelView = {
  id: string;
  name: string;
  issueCount: number;
};

export async function listLabelsWithUsage(): Promise<LabelView[]> {
  return db
    .select({
      id: label.id,
      name: label.name,
      issueCount: count(issueLabel.issueId),
    })
    .from(label)
    .leftJoin(issueLabel, eq(issueLabel.labelId, label.id))
    .groupBy(label.id, label.name)
    .orderBy(sql`lower(${label.name})`);
}

export async function checkLabelNameAvailable(name: string): Promise<{ id: string; name: string } | null> {
  const [row] = await db
    .select({ id: label.id, name: label.name })
    .from(label)
    .where(sql`lower(${label.name}) = lower(${name.trim()})`);
  return row ?? null;
}

export type LabelOption = {
  id: string;
  name: string;
  applied: boolean;
};

export async function listLabelOptionsForIssue(issueId?: string): Promise<LabelOption[]> {
  if (issueId === undefined) {
    const rows = await db
      .select({ id: label.id, name: label.name })
      .from(label)
      .orderBy(sql`lower(${label.name})`);
    return rows.map((row) => ({ ...row, applied: false }));
  }

  return db
    .select({
      id: label.id,
      name: label.name,
      applied: sql<boolean>`${issueLabel.issueId} is not null`,
    })
    .from(label)
    .leftJoin(issueLabel, and(eq(issueLabel.labelId, label.id), eq(issueLabel.issueId, issueId)))
    .orderBy(sql`lower(${label.name})`);
}