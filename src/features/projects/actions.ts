"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireActor } from "@/features/auth/server/actor";
import { assertSameOrigin } from "@/features/auth/server/origin";
import { isValidProjectKey } from "./key";
import { requireAdmin } from "./server/authorization";
import { createProject as runCreateProject } from "./server/create-project";
import { findProjectKeyHolder } from "./server/queries";

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