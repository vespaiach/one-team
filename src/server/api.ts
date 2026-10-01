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

function writeLine(entry: Record<string, string | number>): void {
  process.stdout.write(`${JSON.stringify(entry)}\n`);
}

function errorResponse(status: number, message: string, fields?: Record<string, string>): Response {
  return Response.json({ error: fields ? { message, fields } : { message } }, { status });
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
      response = await handler(request, context);
    } catch (error) {
      if (error instanceof ApiError) {
        response = errorResponse(error.status, error.message, error.fields);
      } else {
        response = errorResponse(500, "Something went wrong.");
        writeLine({
          time: new Date().toISOString(),
          level: "error",
          method,
          path,
          error: error instanceof Error ? error.name : "Error",
        });
      }
    }
    writeLine({
      time: new Date().toISOString(),
      method,
      path,
      status: response.status,
      durationMs: Math.round(performance.now() - started),
    });
    return response;
  };
}