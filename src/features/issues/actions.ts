"use server";

import { refresh, revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireActor } from "@/features/auth/server/actor";
import { assertSameOrigin } from "@/features/auth/server/origin";
import { type CreateIssueResult, createIssue as runCreateIssue } from "./server/create-issue";
import { type DeleteIssueResult, deleteIssue as runDeleteIssue } from "./server/delete-issue";
import { updateIssue as runUpdateIssue, type UpdateIssueResult } from "./server/update-issue";

export type CreateIssueState = CreateIssueResult | { status: "idle" };
export type { UpdateIssueResult };
export type { DeleteIssueResult };

export async function createIssue(
  _prevState: CreateIssueState,
  formData: FormData,
): Promise<CreateIssueState> {
  assertSameOrigin({ headers: await headers() });
  const actor = await requireActor();

  const projectId = formData.get("projectId");
  if (typeof projectId !== "string") {
    return { status: "not-found" };
  }

  const result = await runCreateIssue({
    projectId,
    actor,
    title: formData.get("title"),
    description: formData.get("description"),
    columnId: formData.get("columnId"),
    priority: formData.get("priority"),
    assigneeId: formData.get("assigneeId"),
    dueDate: formData.get("dueDate"),
    labelIds: formData.getAll("labelIds"),
  });

  if (result.status !== "ok") {
    return result;
  }

  redirect(`/projects/${result.projectKey}/issues/${result.number}/details`);
}

export type UpdateIssuePayload = {
  issueId: unknown;
  title?: unknown;
  description?: unknown;
  columnId?: unknown;
  priority?: unknown;
  assigneeId?: unknown;
  dueDate?: unknown;
};

export async function updateIssue(input: UpdateIssuePayload): Promise<UpdateIssueResult> {
  assertSameOrigin({ headers: await headers() });
  const actor = await requireActor();

  if (typeof input.issueId !== "string") {
    return { status: "not-found" };
  }

  const result = await runUpdateIssue({
    issueId: input.issueId,
    actor,
    ...("title" in input ? { title: input.title } : {}),
    ...("description" in input ? { description: input.description } : {}),
    ...("columnId" in input ? { columnId: input.columnId } : {}),
    ...("priority" in input ? { priority: input.priority } : {}),
    ...("assigneeId" in input ? { assigneeId: input.assigneeId } : {}),
    ...("dueDate" in input ? { dueDate: input.dueDate } : {}),
  });

  if (result.status === "ok") {
    refresh();
  }

  return result;
}

export type DeleteIssuePayload = {
  issueId: unknown;
  projectKey: unknown;
};

export async function deleteIssue(input: DeleteIssuePayload): Promise<DeleteIssueResult> {
  assertSameOrigin({ headers: await headers() });
  const actor = await requireActor();

  if (typeof input.issueId !== "string") {
    return { status: "not-found" };
  }

  const result = await runDeleteIssue({ issueId: input.issueId, actor });

  if (result.status === "ok" && typeof input.projectKey === "string") {
    revalidatePath(`/projects/${input.projectKey}/details`);
  }

  return result;
}