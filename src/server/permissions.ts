import { ApiError, apiRoute } from "./api.ts";
import { db } from "./db.ts";
import type { Member } from "./members.ts";
import { readSessionToken, validateSession } from "./session.ts";

export async function requireMember(request: Request): Promise<Member> {
  const token = readSessionToken(request);
  const member = token === null ? null : await validateSession(db(), token);
  if (member === null) {
    throw new ApiError(401, "Not signed in");
  }
  return member;
}

export function requireAdmin(member: Member): Member {
  if (member.role !== "admin") {
    throw new ApiError(403, "You don't have permission to do that.");
  }
  return member;
}

export const unmatchedRoute = apiRoute(async (request) => {
  await requireMember(request);
  throw new ApiError(404, "Not found");
});