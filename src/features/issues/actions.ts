"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireActor } from "@/features/auth/server/actor";
import { assertSameOrigin } from "@/features/auth/server/origin";
import { type CreateIssueResult, createIssue as runCreateIssue } from "./server/create-issue";

export type CreateIssueState = CreateIssueResult | { status: "idle" };

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
  });

  if (result.status !== "ok") {
    return result;
  }

  redirect(`/projects/${result.projectKey}/issues/${result.number}/details`);
}