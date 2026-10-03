import { ApiError, apiRoute } from "../../../server/api.ts";
import { db } from "../../../server/db.ts";
import { unmatchedRoute } from "../../../server/permissions.ts";
import { requestSignInLink } from "../../../server/signIn.ts";

async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  const body: unknown = await request.json().catch(() => null);
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ApiError(422, "Invalid input");
  }
  return body as Record<string, unknown>;
}

function clientIp(request: Request): string {
  const entry = request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim();
  return entry || "unknown";
}

export const POST = apiRoute(async (request) => {
  const body = await readJsonObject(request);
  const result = await requestSignInLink(db(), {
    email: body.email,
    requestId: body.requestId,
    next: body.next,
    ip: clientIp(request),
  });
  return Response.json(result);
});

export const GET = unmatchedRoute;
export const PUT = unmatchedRoute;
export const PATCH = unmatchedRoute;
export const DELETE = unmatchedRoute;
export const HEAD = unmatchedRoute;
export const OPTIONS = unmatchedRoute;