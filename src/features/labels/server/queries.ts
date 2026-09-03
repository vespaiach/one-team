import "server-only";
import { count, eq, sql } from "drizzle-orm";
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