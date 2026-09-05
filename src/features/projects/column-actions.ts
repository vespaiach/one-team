"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { requireActor } from "@/features/auth/server/actor";
import { assertSameOrigin } from "@/features/auth/server/origin";
import { parseColumnId, parseProjectKey } from "./server/column-input";
import { findColumnProjectId } from "./server/column-queries";
import { type CreateColumnResult, createColumn as runCreateColumn } from "./server/create-column";
import {
  type DeleteColumnState as DeleteColumnResult,
  deleteColumn as runDeleteColumn,
} from "./server/delete-column";
import { type MoveColumnState as MoveColumnResult, moveColumn as runMoveColumn } from "./server/move-column";
import { updateColumn as runUpdateColumn, type UpdateColumnResult } from "./server/update-column";

export type CreateColumnPayload = { projectKey: string; name: string };

export type CreateColumnState = CreateColumnResult;

export type UpdateColumnPayload = { columnId: string; name: string };

export type UpdateColumnState = UpdateColumnResult;

export type MoveColumnPayload = {
  columnId: string;
  targetColumnId: string;
  placement: "before" | "after";
};

export type MoveColumnState = MoveColumnResult;

export type DeleteColumnPayload = { columnId: string };

export type DeleteColumnState = DeleteColumnResult;

export async function createColumn(input: CreateColumnPayload): Promise<CreateColumnState> {
  assertSameOrigin({ headers: await headers() });
  const actor = await requireActor();

  const projectKey = parseProjectKey(input.projectKey);
  if (!projectKey) {
    notFound();
  }

  const result = await runCreateColumn({ actor, projectKey, name: input.name });

  if (result.ok) {
    refresh();
  }
  return result;
}

export async function updateColumn(input: UpdateColumnPayload): Promise<UpdateColumnState> {
  assertSameOrigin({ headers: await headers() });
  const actor = await requireActor();

  const columnId = parseColumnId(input.columnId);
  if (!columnId) {
    notFound();
  }

  const result = await runUpdateColumn({ actor, columnId, name: input.name });

  if (result.ok) {
    refresh();
  }
  return result;
}

export async function moveColumn(input: MoveColumnPayload): Promise<MoveColumnState> {
  assertSameOrigin({ headers: await headers() });
  const actor = await requireActor();

  const columnId = parseColumnId(input.columnId);
  if (!columnId) {
    notFound();
  }

  const result = await runMoveColumn({
    actor,
    columnId,
    targetColumnId: input.targetColumnId,
    placement: input.placement,
  });

  if (result.ok) {
    refresh();
  }
  return result;
}

export async function deleteColumn(input: DeleteColumnPayload): Promise<DeleteColumnState> {
  assertSameOrigin({ headers: await headers() });
  const actor = await requireActor();

  const columnId = parseColumnId(input.columnId);
  if (!columnId) {
    notFound();
  }

  const projectId = await findColumnProjectId(columnId);
  if (!projectId) {
    notFound();
  }

  const result = await runDeleteColumn({ actor, projectId, columnId });

  if (result.ok) {
    refresh();
  }
  return result;
}