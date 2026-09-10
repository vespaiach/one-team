import "server-only";
import { count, eq } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import { boardColumn, issue } from "@/db/schema";

async function countOpenIssuesForTeamImpl(): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(issue)
    .innerJoin(boardColumn, eq(boardColumn.id, issue.columnId))
    .where(eq(boardColumn.kind, "open"));

  return row?.total ?? 0;
}

export const countOpenIssuesForTeam = cache(countOpenIssuesForTeamImpl);