import "server-only";
import { and, asc, eq, isNotNull, isNull, type SQL } from "drizzle-orm";
import { generateKeyBetween } from "fractional-indexing";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { boardColumn, issue, project, user } from "@/db/schema";
import { touched } from "@/db/touched";
import { truncateActivityValue, writeActivity } from "@/features/activity/server/write-activity";
import type { Actor } from "@/features/auth/server/actor";
import { dispatchNotificationMail } from "@/features/notifications/server/mail";
import { writeAssignmentNotifications } from "@/features/notifications/server/write-notifications";
import { isMember } from "@/features/projects/server/authorization";
import { parseColumnId, parsePlacement } from "@/features/projects/server/column-input";
import { displayName } from "@/lib/display-name";
import { type IssuePriority, parsePriority } from "./input";
import { listAssigneePool, listProjectColumns } from "./issue-queries";
import { type BoardGrouping, parseGrouping, parseIssueId } from "./move-issue-input";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type MoveIssueInput = {
  actor: Actor;
  issueId: unknown;
  grouping: unknown;
  laneId: unknown;
  targetIssueId: unknown;
  placement: unknown;
};

export type MoveIssueState =
  | { ok: true }
  | { ok: false; error: "not_found" }
  | { ok: false; error: "invalid_target" }
  | { ok: false; error: "forbidden"; reason: string }
  | { ok: false; error: "no_index_available" };

type LaneCard = { id: string; sortOrder: string };

type MoveLane =
  | { field: "column"; columnId: string }
  | { field: "assignee"; assigneeId: string | null }
  | { field: "priority"; priority: IssuePriority };

type LaneResolution = { ok: true; lane: MoveLane } | { ok: false; error: "not_found" | "invalid_target" };

function indexBetween(previous: string | null, next: string | null): string | null {
  try {
    return generateKeyBetween(previous, next);
  } catch {
    return null;
  }
}

async function resolveColumnLane(
  tx: Transaction,
  projectId: string,
  laneId: unknown,
): Promise<LaneResolution> {
  const columnId = parseColumnId(laneId);
  if (columnId === null) {
    return { ok: false, error: "invalid_target" };
  }

  const [lane] = await tx
    .select({ id: boardColumn.id })
    .from(boardColumn)
    .where(and(eq(boardColumn.id, columnId), eq(boardColumn.projectId, projectId)));
  if (lane) {
    return { ok: true, lane: { field: "column", columnId: lane.id } };
  }

  const [elsewhere] = await tx
    .select({ id: boardColumn.id })
    .from(boardColumn)
    .where(eq(boardColumn.id, columnId));
  return elsewhere ? { ok: false, error: "invalid_target" } : { ok: false, error: "not_found" };
}

async function resolveAssigneeLane(
  tx: Transaction,
  projectId: string,
  laneId: unknown,
): Promise<LaneResolution> {
  if (laneId === null) {
    return { ok: true, lane: { field: "assignee", assigneeId: null } };
  }
  if (typeof laneId !== "string") {
    return { ok: false, error: "invalid_target" };
  }

  const pool = await listAssigneePool(projectId);
  if (pool.some((person) => person.id === laneId)) {
    return { ok: true, lane: { field: "assignee", assigneeId: laneId } };
  }

  const assignedHere = await tx
    .selectDistinct({ id: issue.assigneeId })
    .from(issue)
    .where(and(eq(issue.projectId, projectId), isNotNull(issue.assigneeId)));
  return assignedHere.some((row) => row.id === laneId)
    ? { ok: false, error: "invalid_target" }
    : { ok: false, error: "not_found" };
}

function resolvePriorityLane(laneId: unknown): LaneResolution {
  const priority = parsePriority(laneId);
  return priority === null
    ? { ok: false, error: "invalid_target" }
    : { ok: true, lane: { field: "priority", priority } };
}

async function resolveLane(
  tx: Transaction,
  projectId: string,
  grouping: BoardGrouping,
  laneId: unknown,
): Promise<LaneResolution> {
  if (grouping === "column") {
    return resolveColumnLane(tx, projectId, laneId);
  }
  if (grouping === "assignee") {
    return resolveAssigneeLane(tx, projectId, laneId);
  }
  return resolvePriorityLane(laneId);
}

function laneMembership(lane: MoveLane): SQL | undefined {
  if (lane.field === "column") {
    return eq(issue.columnId, lane.columnId);
  }
  if (lane.field === "assignee") {
    return lane.assigneeId === null ? isNull(issue.assigneeId) : eq(issue.assigneeId, lane.assigneeId);
  }
  return eq(issue.priority, lane.priority);
}

function laneHolds(row: typeof issue.$inferSelect, lane: MoveLane): boolean {
  if (lane.field === "column") {
    return row.columnId === lane.columnId;
  }
  if (lane.field === "assignee") {
    return row.assigneeId === lane.assigneeId;
  }
  return row.priority === lane.priority;
}

async function personName(tx: Transaction, personId: string | null): Promise<string | null> {
  if (personId === null) {
    return null;
  }
  const [person] = await tx
    .select({ firstName: user.firstName, lastName: user.lastName })
    .from(user)
    .where(eq(user.id, personId));
  return person ? displayName(person) : null;
}

async function laneDiff(
  tx: Transaction,
  projectId: string,
  row: typeof issue.$inferSelect,
  lane: MoveLane,
): Promise<{ field: string; fromValue: string | null; toValue: string | null }> {
  if (lane.field === "column") {
    const nameById = new Map((await listProjectColumns(projectId)).map((column) => [column.id, column.name]));
    return {
      field: "column",
      fromValue: nameById.get(row.columnId) ?? null,
      toValue: nameById.get(lane.columnId) ?? null,
    };
  }
  if (lane.field === "assignee") {
    return {
      field: "assignee",
      fromValue: await personName(tx, row.assigneeId),
      toValue: await personName(tx, lane.assigneeId),
    };
  }
  return { field: "priority", fromValue: row.priority, toValue: lane.priority };
}

function laneFields(lane: MoveLane): Partial<typeof issue.$inferInsert> {
  if (lane.field === "column") {
    return { columnId: lane.columnId };
  }
  if (lane.field === "assignee") {
    return { assigneeId: lane.assigneeId };
  }
  return { priority: lane.priority };
}

export async function moveIssue(input: MoveIssueInput): Promise<MoveIssueState> {
  const movedId = parseIssueId(input.issueId);
  if (movedId === null) {
    notFound();
  }

  let pendingMail: string[] = [];

  const state = await db.transaction(async (tx): Promise<MoveIssueState> => {
    const [row] = await tx.select().from(issue).where(eq(issue.id, movedId)).for("update");
    if (!row) {
      return { ok: false, error: "not_found" };
    }

    const [projectRow] = await tx.select().from(project).where(eq(project.id, row.projectId));
    if (!projectRow) {
      return { ok: false, error: "not_found" };
    }

    if (!(await isMember(input.actor, projectRow.id))) {
      return {
        ok: false,
        error: "forbidden",
        reason: `Only project members can move issues in ${projectRow.name}.`,
      };
    }

    const grouping = parseGrouping(input.grouping);
    const placement = parsePlacement(input.placement);
    if (grouping === null || placement === null) {
      return { ok: false, error: "invalid_target" };
    }

    const resolved = await resolveLane(tx, projectRow.id, grouping, input.laneId);
    if (!resolved.ok) {
      return { ok: false, error: resolved.error };
    }
    const lane = resolved.lane;

    const targetId = input.targetIssueId === null ? null : parseIssueId(input.targetIssueId);
    if (input.targetIssueId !== null && targetId === null) {
      return { ok: false, error: "not_found" };
    }

    const laneCards = await tx
      .select({ id: issue.id, sortOrder: issue.sortOrder })
      .from(issue)
      .where(and(eq(issue.projectId, projectRow.id), laneMembership(lane)))
      .orderBy(asc(issue.sortOrder), asc(issue.id));

    const moved: LaneCard = { id: row.id, sortOrder: row.sortOrder };
    const reordered: LaneCard[] = [];
    if (targetId === null) {
      const others = laneCards.filter((card) => card.id !== moved.id);
      reordered.push(...(placement === "before" ? [moved, ...others] : [...others, moved]));
    } else {
      const target = laneCards.find((card) => card.id === targetId);
      if (!target) {
        return { ok: false, error: "not_found" };
      }
      for (const card of laneCards) {
        if (card.id === target.id && placement === "before") {
          reordered.push(moved);
        }
        if (card.id !== moved.id) {
          reordered.push(card);
        }
        if (card.id === target.id && placement === "after") {
          reordered.push(moved);
        }
      }
    }

    const index = reordered.findIndex((card) => card.id === moved.id);
    const laneUnchanged = laneHolds(row, lane);
    if (laneUnchanged && index === laneCards.findIndex((card) => card.id === moved.id)) {
      return { ok: true };
    }

    const sortOrder = indexBetween(
      reordered[index - 1]?.sortOrder ?? null,
      reordered[index + 1]?.sortOrder ?? null,
    );
    if (sortOrder === null) {
      return { ok: false, error: "no_index_available" };
    }

    const fields: Partial<typeof issue.$inferInsert> = laneUnchanged
      ? { sortOrder }
      : { sortOrder, ...laneFields(lane) };

    await tx.update(issue).set(touched(fields)).where(eq(issue.id, moved.id));

    if (!laneUnchanged) {
      if (lane.field === "assignee") {
        pendingMail = await writeAssignmentNotifications(tx, {
          issueId: moved.id,
          assigneeId: lane.assigneeId,
          actorId: input.actor.id,
        });
      }

      const diff = await laneDiff(tx, projectRow.id, row, lane);
      await writeActivity(tx, {
        type: "field_changed",
        target: { issueId: moved.id },
        actorId: input.actor.id,
        field: diff.field,
        fromValue: truncateActivityValue(diff.fromValue),
        toValue: truncateActivityValue(diff.toValue),
      });
    }

    return { ok: true };
  });

  dispatchNotificationMail(pendingMail);

  return state;
}