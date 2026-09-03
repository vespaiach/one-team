"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { requireActor } from "@/features/auth/server/actor";
import { assertSameOrigin } from "@/features/auth/server/origin";
import { isValidProjectKey } from "./key";
import { requireAdmin } from "./server/authorization";
import { createProject as runCreateProject } from "./server/create-project";
import { deleteProject as runDeleteProject } from "./server/delete-project";
import {
  addProjectMember as runAddProjectMember,
  removeProjectMember as runRemoveProjectMember,
} from "./server/membership";
import { setProjectStatus as runSetProjectStatus } from "./server/project-status";
import { findProjectKeyHolder, loadProjectByKey } from "./server/queries";
import { updateProject as runUpdateProject, type UpdateProjectChanges } from "./server/update-project";

const MAX_NAME_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 10000;

export type CreateProjectPayload = {
  name: string;
  key: string;
  description: string | null;
  startDate: string | null;
  targetDate: string | null;
  memberIds: string[];
};

export type CreateProjectState =
  | { status: "idle" }
  | { status: "key_taken"; holder: { key: string; name: string } }
  | { status: "invalid"; field: "name" | "key" | "description" | "targetDate"; reason: string }
  | { status: "forbidden" };

export async function createProject(
  _prevState: CreateProjectState,
  input: CreateProjectPayload,
): Promise<CreateProjectState> {
  assertSameOrigin({ headers: await headers() });
  const actor = await requireActor();
  if (actor.role !== "admin") {
    return { status: "forbidden" };
  }

  const name = input.name.trim();
  if (name === "" || name.length > MAX_NAME_LENGTH) {
    return { status: "invalid", field: "name", reason: "required" };
  }

  if (!isValidProjectKey(input.key)) {
    return { status: "invalid", field: "key", reason: "pattern" };
  }

  const description =
    input.description !== null && input.description.trim() === "" ? null : input.description;
  if (description !== null && description.length > MAX_DESCRIPTION_LENGTH) {
    return { status: "invalid", field: "description", reason: "too_long" };
  }

  if (input.startDate && input.targetDate && input.targetDate < input.startDate) {
    return { status: "invalid", field: "targetDate", reason: "before_start" };
  }

  const memberIds = [...new Set(input.memberIds)].filter((id) => id !== actor.id);

  const result = await runCreateProject({
    name,
    key: input.key,
    description,
    startDate: input.startDate,
    targetDate: input.targetDate,
    memberIds,
  });

  if (result.status === "key_taken") {
    return { status: "key_taken", holder: result.holder };
  }

  refresh();
  redirect(`/projects/${result.projectKey}`);
}

export async function checkProjectKeyAvailable(
  key: string,
): Promise<{ holder: { key: string; name: string } | null }> {
  assertSameOrigin({ headers: await headers() });
  await requireAdmin();

  const holder = await findProjectKeyHolder(key);
  return { holder };
}

const UPDATE_PROJECT_FIELDS = new Set(["name", "description", "startDate", "targetDate"]);

export type UpdateProjectPayload = {
  projectKey: string;
  changes: UpdateProjectChanges;
};

export type UpdateProjectState =
  | { status: "saved" }
  | { status: "invalid"; field: "name" | "description" | "startDate" | "targetDate"; reason: string }
  | { status: "forbidden" };

export async function updateProject(input: UpdateProjectPayload): Promise<UpdateProjectState> {
  assertSameOrigin({ headers: await headers() });
  const actor = await requireActor();

  const changes = input.changes as Record<string, unknown>;
  if (Object.keys(changes).some((key) => !UPDATE_PROJECT_FIELDS.has(key))) {
    return { status: "forbidden" };
  }

  const normalized: UpdateProjectChanges = { ...input.changes };

  if ("name" in normalized) {
    const name = normalized.name?.trim() ?? "";
    if (name === "" || name.length > MAX_NAME_LENGTH) {
      return { status: "invalid", field: "name", reason: "required" };
    }
    normalized.name = name;
  }

  if ("description" in normalized) {
    const description = normalized.description ?? null;
    const trimmed = description !== null && description.trim() === "" ? null : description;
    if (trimmed !== null && trimmed.length > MAX_DESCRIPTION_LENGTH) {
      return { status: "invalid", field: "description", reason: "too_long" };
    }
    normalized.description = trimmed;
  }

  if ("startDate" in normalized && "targetDate" in normalized) {
    const { startDate, targetDate } = normalized;
    if (startDate && targetDate && targetDate < startDate) {
      return { status: "invalid", field: "targetDate", reason: "before_start" };
    }
  }

  const project = await loadProjectByKey(input.projectKey);
  if (!project) {
    notFound();
  }

  const result = await runUpdateProject(project.id, actor, normalized);

  if (result.status === "not_found") {
    notFound();
  }

  refresh();
  return result;
}

export type MembershipPayload = { projectKey: string; userId: string };

export type MembershipState = { status: "saved" } | { status: "forbidden" };

export async function addProjectMember(input: MembershipPayload): Promise<MembershipState> {
  assertSameOrigin({ headers: await headers() });
  const actor = await requireActor();
  if (actor.role !== "admin") {
    return { status: "forbidden" };
  }

  const project = await loadProjectByKey(input.projectKey);
  if (!project) {
    notFound();
  }

  await runAddProjectMember(project.id, input.userId);

  refresh();
  return { status: "saved" };
}

export async function removeProjectMember(input: MembershipPayload): Promise<MembershipState> {
  assertSameOrigin({ headers: await headers() });
  const actor = await requireActor();
  if (actor.role !== "admin") {
    return { status: "forbidden" };
  }

  const project = await loadProjectByKey(input.projectKey);
  if (!project) {
    notFound();
  }

  await runRemoveProjectMember(project.id, input.userId);

  refresh();
  return { status: "saved" };
}

const PROJECT_STATUS_VALUES = new Set(["active", "archived"]);

export type SetProjectStatusPayload = { projectKey: string; status: "active" | "archived" };

export type SetProjectStatusState = { status: "saved" } | { status: "forbidden" };

export async function setProjectStatus(input: SetProjectStatusPayload): Promise<SetProjectStatusState> {
  assertSameOrigin({ headers: await headers() });
  const actor = await requireActor();
  if (actor.role !== "admin") {
    return { status: "forbidden" };
  }

  if (!PROJECT_STATUS_VALUES.has(input.status)) {
    return { status: "forbidden" };
  }

  const project = await loadProjectByKey(input.projectKey);
  if (!project) {
    notFound();
  }

  await runSetProjectStatus(project.id, input.status);

  refresh();
  return { status: "saved" };
}

export type DeleteProjectPayload = { projectKey: string };

export type DeleteProjectState = { status: "deleted" } | { status: "not_archived" } | { status: "forbidden" };

export async function deleteProject(input: DeleteProjectPayload): Promise<DeleteProjectState> {
  assertSameOrigin({ headers: await headers() });
  const actor = await requireActor();
  if (actor.role !== "admin") {
    return { status: "forbidden" };
  }

  const project = await loadProjectByKey(input.projectKey);
  if (!project) {
    notFound();
  }

  const result = await runDeleteProject(project.id);
  if (result.status === "not_found") {
    notFound();
  }

  if (result.status === "deleted") {
    refresh();
  }
  return result;
}