import "server-only";
import { and, asc, eq, exists, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { boardColumn, projectMember, user } from "@/db/schema";
import { publicUser } from "@/features/auth/server/projections";

export type IssueColumnOption = {
  id: string;
  name: string;
};

export async function listProjectColumns(projectId: string): Promise<IssueColumnOption[]> {
  return db
    .select({ id: boardColumn.id, name: boardColumn.name })
    .from(boardColumn)
    .where(eq(boardColumn.projectId, projectId))
    .orderBy(asc(boardColumn.sortOrder));
}

export type AssigneeOption = {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  jobTitle: string | null;
};

export async function listAssigneePool(projectId: string): Promise<AssigneeOption[]> {
  const rows = await db
    .select(publicUser)
    .from(user)
    .where(
      and(
        isNull(user.deactivatedAt),
        or(
          eq(user.role, "admin"),
          exists(
            db
              .select({ one: sql`1` })
              .from(projectMember)
              .where(and(eq(projectMember.projectId, projectId), eq(projectMember.userId, user.id))),
          ),
        ),
      ),
    )
    .orderBy(sql`lower(${user.lastName})`, sql`lower(${user.firstName})`);

  return rows.map((row) => ({
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    avatarUrl: row.avatarUrl,
    jobTitle: row.jobTitle,
  }));
}