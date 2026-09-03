import "server-only";
import { type Actor, requireActor } from "@/features/auth/server/actor";
import { hasProjectMemberRow } from "./queries";

export class ForbiddenActorError extends Error {
  constructor() {
    super("forbidden");
  }
}

function isAdmin(actor: Actor): boolean {
  return actor.role === "admin";
}

export async function isMember(actor: Actor, projectId: string): Promise<boolean> {
  return isAdmin(actor) || (await hasProjectMemberRow(projectId, actor.id));
}

export async function requireAdmin(): Promise<Actor> {
  const actor = await requireActor();
  if (!isAdmin(actor)) {
    throw new ForbiddenActorError();
  }
  return actor;
}

export async function requireMember(projectId: string): Promise<Actor> {
  const actor = await requireActor();
  if (!(await isMember(actor, projectId))) {
    throw new ForbiddenActorError();
  }
  return actor;
}