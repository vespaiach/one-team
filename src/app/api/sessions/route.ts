import { ApiError, apiRoute } from "../../../server/api.ts";
import { db } from "../../../server/db.ts";
import { unmatchedRoute } from "../../../server/permissions.ts";
import { readSessionToken, sessionCookie } from "../../../server/session.ts";
import { redeemSignInLink } from "../../../server/signIn.ts";

async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  const body: unknown = await request.json().catch(() => null);
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ApiError(422, "Invalid input");
  }
  return body as Record<string, unknown>;
}

export const POST = apiRoute(async (request) => {
  const body = await readJsonObject(request);
  const result = await redeemSignInLink(db(), {
    token: body.token,
    requestId: body.requestId,
    sessionToken: readSessionToken(request),
  });
  if (result.outcome !== "signedIn") {
    return Response.json(result);
  }
  const { sessionToken, ...answer } = result;
  return Response.json(answer, { headers: { "Set-Cookie": sessionCookie(sessionToken) } });
});

export const GET = unmatchedRoute;
export const PUT = unmatchedRoute;
export const PATCH = unmatchedRoute;
export const DELETE = unmatchedRoute;
export const HEAD = unmatchedRoute;
export const OPTIONS = unmatchedRoute;