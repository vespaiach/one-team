"use server";

import { refresh, revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requireActor } from "@/features/auth/server/actor";
import { assertSameOrigin } from "@/features/auth/server/origin";
import { requireAdmin } from "@/features/projects/server/authorization";
import { createLabel as runCreateLabel } from "./server/create-label";
import { type DeleteLabelResult, deleteLabel as runDeleteLabel } from "./server/delete-label";
import {
  type IssueLabelResult,
  addIssueLabel as runAddIssueLabel,
  removeIssueLabel as runRemoveIssueLabel,
} from "./server/issue-labels";
import type { LabelView } from "./server/queries";
import { checkLabelNameAvailable as runCheckLabelNameAvailable } from "./server/queries";
import { updateLabel as runUpdateLabel } from "./server/update-label";

export type { DeleteLabelResult, IssueLabelResult };

const LABELS_SCREEN_PATH = "/settings/labels";

export type LabelFormState =
  | { status: "idle" }
  | { status: "saved"; label: LabelView }
  | { status: "forbidden" }
  | { status: "invalid_name" }
  | { status: "not_found" }
  | { status: "duplicate_name"; holder: { id: string; name: string } };

export async function createLabel(
  _prevState: LabelFormState,
  input: { name: string },
): Promise<LabelFormState> {
  assertSameOrigin({ headers: await headers() });
  const actor = await requireActor();

  const result = await runCreateLabel({ actor, name: input.name });
  if (!result.ok) {
    if (result.error === "duplicate_name") {
      return { status: "duplicate_name", holder: result.holder };
    }
    return { status: result.error };
  }

  revalidatePath(LABELS_SCREEN_PATH);
  return { status: "saved", label: result.label };
}

export async function updateLabel(
  _prevState: LabelFormState,
  input: { id: string; name: string },
): Promise<LabelFormState> {
  assertSameOrigin({ headers: await headers() });
  const actor = await requireActor();

  const result = await runUpdateLabel({ actor, id: input.id, name: input.name });
  if (!result.ok) {
    if (result.error === "duplicate_name") {
      return { status: "duplicate_name", holder: result.holder };
    }
    return { status: result.error };
  }

  revalidatePath(LABELS_SCREEN_PATH);
  return { status: "saved", label: result.label };
}

export async function deleteLabel(id: string): Promise<DeleteLabelResult> {
  assertSameOrigin({ headers: await headers() });
  const actor = await requireActor();

  const result = await runDeleteLabel({ actor, id });
  if (result.ok) {
    revalidatePath(LABELS_SCREEN_PATH);
  }
  return result;
}

export type IssueLabelPayload = {
  issueId: unknown;
  labelId: unknown;
};

export async function addIssueLabel(input: IssueLabelPayload): Promise<IssueLabelResult> {
  assertSameOrigin({ headers: await headers() });
  const actor = await requireActor();

  if (typeof input.issueId !== "string" || typeof input.labelId !== "string") {
    return { ok: false, error: "not_found" };
  }

  const result = await runAddIssueLabel({ actor, issueId: input.issueId, labelId: input.labelId });
  if (result.ok) {
    refresh();
  }
  return result;
}

export async function removeIssueLabel(input: IssueLabelPayload): Promise<IssueLabelResult> {
  assertSameOrigin({ headers: await headers() });
  const actor = await requireActor();

  if (typeof input.issueId !== "string" || typeof input.labelId !== "string") {
    return { ok: false, error: "not_found" };
  }

  const result = await runRemoveIssueLabel({ actor, issueId: input.issueId, labelId: input.labelId });
  if (result.ok) {
    refresh();
  }
  return result;
}

export async function checkLabelNameAvailable(
  name: string,
): Promise<{ holder: { id: string; name: string } | null }> {
  assertSameOrigin({ headers: await headers() });
  await requireAdmin();

  const holder = await runCheckLabelNameAvailable(name);
  return { holder };
}