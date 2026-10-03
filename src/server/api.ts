import { readAppSettings } from "./config.ts";
import { writeLogLine } from "./log.ts";
import { clearSessionCookie, readSessionToken } from "./session.ts";

export class ApiError extends Error {
  readonly status: number;
  readonly fields?: Record<string, string>;

  constructor(status: number, message: string, fields?: Record<string, string>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fields = fields;
  }
}

function errorResponse(status: number, message: string, fields?: Record<string, string>): Response {
  return Response.json({ error: fields ? { message, fields } : { message } }, { status });
}

const writeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function isCrossSiteWrite(request: Request): boolean {
  if (!writeMethods.has(request.method)) {
    return false;
  }
  const site = request.headers.get("sec-fetch-site");
  if (site !== null) {
    return site !== "same-origin";
  }
  const origin = request.headers.get("origin");
  return origin !== null && origin !== new URL(readAppSettings().appUrl).origin;
}

export function apiRoute<Context>(
  handler: (request: Request, context: Context) => Promise<Response> | Response,
): (request: Request, context: Context) => Promise<Response> {
  return async (request, context) => {
    const started = performance.now();
    const method = request.method;
    const path = new URL(request.url).pathname;
    let response: Response;
    try {
      if (isCrossSiteWrite(request)) {
        throw new ApiError(403, "You don't have permission to do that.");
      }
      response = await handler(request, context);
    } catch (error) {
      if (error instanceof ApiError) {
        response = errorResponse(error.status, error.message, error.fields);
        if (error.status === 401 && readSessionToken(request) !== null) {
          response.headers.append("Set-Cookie", clearSessionCookie());
        }
      } else {
        response = errorResponse(500, "Something went wrong.");
        writeLogLine({
          time: new Date().toISOString(),
          level: "error",
          method,
          path,
          error: error instanceof Error ? error.name : "Error",
        });
      }
    }
    writeLogLine({
      time: new Date().toISOString(),
      method,
      path,
      status: response.status,
      durationMs: Math.round(performance.now() - started),
    });
    return response;
  };
}