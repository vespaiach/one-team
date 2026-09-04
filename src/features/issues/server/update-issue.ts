import "server-only";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { issue, project, user } from "@/db/schema";
import { touched } from "@/db/touched";
import { truncateActivityValue, writeActivity } from "@/features/activity/server/write-activity";
import type { Actor } from "@/features/auth/server/actor";
import { publicUser } from "@/features/auth/server/projections";
import { isMember } from "@/features/projects/server/authorization";
import { parseDescription, parseDueDate, parsePriority, parseTitle } from "./input";
import { listAssigneePool, listProjectColumns } from "./issue-queries";

export type UpdateIssueField = "title" | "description" | "columnId" | "priority" | "assigneeId" | "dueDate";

export type UpdateIssueInvalidReason =
  | "required"
  | "too-long"
  | "not-a-member-of-this-project"
  | "unknown-value"
  | "malformed";

export type UpdateIssueInput = {
  issueId: string;
  actor: Actor;
  title?: unknown;
  description?: unknown;
  columnId?: unknown;
  priority?: unknown;
  assigneeId?: unknown;
  dueDate?: unknown;
};

export type UpdateIssueResult =
  | { status: "ok" }
  | { status: "forbidden"; reason: string }
  | { status: "not-found" }
  | { status: "invalid"; field: UpdateIssueField; reason: UpdateIssueInvalidReason };

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

const FOREIGN_KEY_VIOLATION = "23503";
const INVALID_TEXT_REPRESENTATION = "22P02";

function isColumnReferenceViolation(error: unknown): boolean {
  const candidate = error instanceof Error ? error.cause : error;
  if (typeof candidate !== "object" || candidate === null || !("code" in candidate)) {
    return false;
  }
  const code = (candidate as { code: unknown }).code;
  return code === FOREIGN_KEY_VIOLATION || code === INVALID_TEXT_REPRESENTATION;
}

export async function updateIssue(input: UpdateIssueInput): Promise<UpdateIssueResult> {
  try {
    return await runUpdateIssue(input);
  } catch (error) {
    if (isColumnReferenceViolation(error)) {
      return { status: "invalid", field: "columnId", reason: "unknown-value" };
    }
    throw error;
  }
}

async function runUpdateIssue(input: UpdateIssueInput): Promise<UpdateIssueResult> {
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(issue).where(eq(issue.id, input.issueId)).for("update");
    if (!row) {
      return { status: "not-found" };
    }

    const [projectRow] = await tx.select().from(project).where(eq(project.id, row.projectId));
    if (!projectRow) {
      return { status: "not-found" };
    }

    if (!(await isMember(input.actor, projectRow.id))) {
      return { status: "forbidden", reason: `Only project members can edit issues in ${projectRow.name}.` };
    }

    const fields: Partial<typeof issue.$inferInsert> = {};

    if ("title" in input) {
      const title = parseTitle(input.title);
      if (title === null) {
        return {
          status: "invalid",
          field: "title",
          reason: isNonEmptyString(input.title) ? "too-long" : "required",
        };
      }
      if (title !== row.title) {
        fields.title = title;
      }
    }

    if ("description" in input) {
      const description = parseDescription(input.description);
      if (description === null) {
        return { status: "invalid", field: "description", reason: "too-long" };
      }
      const normalizedDescription = description === "" ? null : description;
      if (normalizedDescription !== row.description) {
        fields.description = normalizedDescription;
      }
    }

    if ("priority" in input) {
      const priority = parsePriority(input.priority);
      if (priority === null) {
        return { status: "invalid", field: "priority", reason: "unknown-value" };
      }
      if (priority !== row.priority) {
        fields.priority = priority;
      }
    }

    if ("assigneeId" in input) {
      if (input.assigneeId === null) {
        if (row.assigneeId !== null) {
          fields.assigneeId = null;
        }
      } else if (isNonEmptyString(input.assigneeId)) {
        const pool = await listAssigneePool(projectRow.id);
        const chosen = pool.find((candidate) => candidate.id === input.assigneeId);
        if (!chosen) {
          return { status: "invalid", field: "assigneeId", reason: "not-a-member-of-this-project" };
        }
        if (chosen.id !== row.assigneeId) {
          fields.assigneeId = chosen.id;
        }
      } else {
        return { status: "invalid", field: "assigneeId", reason: "malformed" };
      }
    }

    if ("dueDate" in input) {
      if (input.dueDate === null) {
        if (row.dueDate !== null) {
          fields.dueDate = null;
        }
      } else {
        const dueDate = parseDueDate(input.dueDate);
        if (dueDate === null) {
          return { status: "invalid", field: "dueDate", reason: "malformed" };
        }
        if (dueDate !== row.dueDate) {
          fields.dueDate = dueDate;
        }
      }
    }

    if ("columnId" in input) {
      if (typeof input.columnId !== "string" || input.columnId.trim() === "") {
        return { status: "invalid", field: "columnId", reason: "malformed" };
      }
      if (input.columnId !== row.columnId) {
        fields.columnId = input.columnId;
      }
    }

    if (Object.keys(fields).length === 0) {
      return { status: "ok" };
    }

    const diffs: { field: string; fromValue: string | null; toValue: string | null }[] = [];

    if ("title" in fields) {
      diffs.push({ field: "title", fromValue: row.title, toValue: fields.title as string });
    }
    if ("description" in fields) {
      diffs.push({
        field: "description",
        fromValue: truncateActivityValue(row.description),
        toValue: truncateActivityValue((fields.description as string | null) ?? null),
      });
    }
    if ("priority" in fields) {
      diffs.push({ field: "priority", fromValue: row.priority, toValue: fields.priority as string });
    }
    if ("dueDate" in fields) {
      diffs.push({
        field: "due_date",
        fromValue: row.dueDate,
        toValue: (fields.dueDate as string | null) ?? null,
      });
    }
    if ("assigneeId" in fields) {
      const newAssigneeId = fields.assigneeId as string | null;
      const idsToResolve = [row.assigneeId, newAssigneeId].filter((id): id is string => id !== null);
      const names =
        idsToResolve.length > 0
          ? await tx.select(publicUser).from(user).where(inArray(user.id, idsToResolve))
          : [];
      const nameById = new Map(
        names.map((candidate) => [candidate.id, `${candidate.firstName} ${candidate.lastName}`]),
      );
      diffs.push({
        field: "assignee",
        fromValue: row.assigneeId ? (nameById.get(row.assigneeId) ?? null) : null,
        toValue: newAssigneeId ? (nameById.get(newAssigneeId) ?? null) : null,
      });
    }
    if ("columnId" in fields) {
      const newColumnId = fields.columnId as string;
      const columns = await listProjectColumns(projectRow.id);
      const nameById = new Map(columns.map((column) => [column.id, column.name]));
      diffs.push({
        field: "column",
        fromValue: nameById.get(row.columnId) ?? null,
        toValue: nameById.get(newColumnId) ?? null,
      });
    }

    await tx.update(issue).set(touched(fields)).where(eq(issue.id, input.issueId));

    for (const diff of diffs) {
      await writeActivity(tx, {
        type: "field_changed",
        target: { issueId: input.issueId },
        actorId: input.actor.id,
        field: diff.field,
        fromValue: diff.fromValue,
        toValue: diff.toValue,
      });
    }

    return { status: "ok" };
  });
}