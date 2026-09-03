import "server-only";
import { desc, eq, sql, TransactionRollbackError } from "drizzle-orm";
import { generateKeyBetween } from "fractional-indexing";
import { db } from "@/db";
import { issue, issueCounter, project } from "@/db/schema";
import { touched } from "@/db/touched";
import type { Actor } from "@/features/auth/server/actor";
import { isMember } from "@/features/projects/server/authorization";
import { type IssuePriority, parseDescription, parseDueDate, parsePriority, parseTitle } from "./input";
import { listAssigneePool, listProjectColumns } from "./issue-queries";

export type CreateIssueField = "title" | "description" | "priority" | "columnId" | "assigneeId" | "dueDate";

export type CreateIssueInvalidReason =
  | "required"
  | "too-long"
  | "not-a-member-of-this-project"
  | "unknown-value"
  | "malformed";

export type CreateIssueInput = {
  projectId: string;
  actor: Actor;
  title: unknown;
  description: unknown;
  columnId: unknown;
  priority: unknown;
  assigneeId: unknown;
  dueDate: unknown;
};

export type CreateIssueResult =
  | { status: "ok"; projectKey: string; number: number }
  | { status: "forbidden"; reason: string }
  | { status: "not-found" }
  | { status: "no-counter" }
  | { status: "invalid"; field: CreateIssueField; reason: CreateIssueInvalidReason };

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

export async function createIssue(input: CreateIssueInput): Promise<CreateIssueResult> {
  const [projectRow] = await db.select().from(project).where(eq(project.id, input.projectId));
  if (!projectRow) {
    return { status: "not-found" };
  }

  if (!(await isMember(input.actor, projectRow.id))) {
    return { status: "forbidden", reason: `Only project members can create issues in ${projectRow.name}.` };
  }

  const title = parseTitle(input.title);
  if (title === null) {
    return {
      status: "invalid",
      field: "title",
      reason: isNonEmptyString(input.title) ? "too-long" : "required",
    };
  }

  const description = parseDescription(input.description ?? "");
  if (description === null) {
    return { status: "invalid", field: "description", reason: "too-long" };
  }

  let priority: IssuePriority = "none";
  if (isNonEmptyString(input.priority)) {
    const parsedPriority = parsePriority(input.priority);
    if (parsedPriority === null) {
      return { status: "invalid", field: "priority", reason: "unknown-value" };
    }
    priority = parsedPriority;
  }

  const columns = await listProjectColumns(projectRow.id);
  const firstColumn = columns[0];
  if (!firstColumn) {
    throw new Error(`createIssue: project ${projectRow.id} has no columns`);
  }
  let columnId = firstColumn.id;
  if (isNonEmptyString(input.columnId)) {
    const chosenColumn = columns.find((column) => column.id === input.columnId);
    if (!chosenColumn) {
      return { status: "invalid", field: "columnId", reason: "unknown-value" };
    }
    columnId = chosenColumn.id;
  }

  let assigneeId: string | null = null;
  if (isNonEmptyString(input.assigneeId)) {
    const pool = await listAssigneePool(projectRow.id);
    const chosenAssignee = pool.find((candidate) => candidate.id === input.assigneeId);
    if (!chosenAssignee) {
      return { status: "invalid", field: "assigneeId", reason: "not-a-member-of-this-project" };
    }
    assigneeId = chosenAssignee.id;
  }

  let dueDate: string | null = null;
  if (isNonEmptyString(input.dueDate)) {
    const parsedDueDate = parseDueDate(input.dueDate);
    if (parsedDueDate === null) {
      return { status: "invalid", field: "dueDate", reason: "malformed" };
    }
    dueDate = parsedDueDate;
  }

  const now = new Date();

  try {
    const number = await db.transaction(async (tx) => {
      const [highest] = await tx
        .select({ sortOrder: issue.sortOrder })
        .from(issue)
        .where(eq(issue.projectId, projectRow.id))
        .orderBy(desc(issue.sortOrder))
        .limit(1);

      const [counterRow] = await tx
        .update(issueCounter)
        .set({ lastNumber: sql`${issueCounter.lastNumber} + 1` })
        .where(eq(issueCounter.projectId, projectRow.id))
        .returning({ lastNumber: issueCounter.lastNumber });

      if (!counterRow) {
        tx.rollback();
      }

      const sortOrder = generateKeyBetween(highest?.sortOrder ?? null, null);

      await tx.insert(issue).values(
        touched({
          projectId: projectRow.id,
          number: counterRow.lastNumber,
          title,
          description: description === "" ? null : description,
          columnId,
          priority,
          assigneeId,
          dueDate,
          createdBy: input.actor.id,
          sortOrder,
          createdAt: now,
        }),
      );

      return counterRow.lastNumber;
    });

    return { status: "ok", projectKey: projectRow.key, number };
  } catch (error) {
    if (error instanceof TransactionRollbackError) {
      return { status: "no-counter" };
    }
    throw error;
  }
}