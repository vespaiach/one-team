import "server-only";

export class ForbiddenOriginError extends Error {
  constructor() {
    super("forbidden_origin");
  }
}

function requireAppOrigin(): string {
  const appUrl = process.env.APP_URL;
  if (!appUrl) {
    throw new Error("APP_URL is not set");
  }
  return new URL(appUrl).origin;
}

export function assertSameOrigin(request: { headers: Pick<Headers, "get"> }): void {
  const origin = request.headers.get("origin");
  if (!origin || origin !== requireAppOrigin()) {
    throw new ForbiddenOriginError();
  }
}