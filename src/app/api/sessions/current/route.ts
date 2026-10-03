import { apiRoute } from "../../../../server/api.ts";
import { db } from "../../../../server/db.ts";
import { unmatchedRoute } from "../../../../server/permissions.ts";
import { clearSessionCookie, endSession, readSessionToken } from "../../../../server/session.ts";

export const DELETE = apiRoute(async (request) => {
  const token = readSessionToken(request);
  if (token !== null) {
    await endSession(db(), token);
  }
  return new Response(null, { status: 204, headers: { "Set-Cookie": clearSessionCookie() } });
});

export const GET = unmatchedRoute;
export const POST = unmatchedRoute;
export const PUT = unmatchedRoute;
export const PATCH = unmatchedRoute;
export const HEAD = unmatchedRoute;
export const OPTIONS = unmatchedRoute;