import { ApiError, apiRoute } from "../../../server/api.ts";

type Context = { params: Promise<{ path?: string[] }> };

const notFound = apiRoute<Context>(() => {
  throw new ApiError(404, "Not found");
});

export const GET = notFound;
export const POST = notFound;
export const PUT = notFound;
export const PATCH = notFound;
export const DELETE = notFound;
export const HEAD = notFound;
export const OPTIONS = notFound;