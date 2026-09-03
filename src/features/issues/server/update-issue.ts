import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { issue, project } from "@/db/schema";
import { touched } from "@/db/touched";
import type { Actor } from "@/features/auth/server/actor";
import { isMember } from "@/features/projects/server/authorization";
import { parseDescription, parseDueDate, parsePriority, parseTitle } from "./input";
import { listAssigneePool } from "./issue-queries";

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

    await tx.update(issue).set(touched(fields)).where(eq(issue.id, input.issueId));

    return { status: "ok" };
  });
}