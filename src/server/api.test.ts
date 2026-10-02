import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { ApiError, apiRoute } from "./api.ts";

let writeSpy: MockInstance<typeof process.stdout.write>;

function loggedText(): string {
  return writeSpy.mock.calls.map((call) => String(call[0])).join("");
}

function loggedLines(): Record<string, unknown>[] {
  return loggedText()
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

describe("apiRoute logging", () => {
  beforeEach(() => {
    writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes one JSON timing line per request", async () => {
    const route = apiRoute(() => Response.json({ ok: true }, { status: 201 }));

    await route(new Request("http://localhost/api/items", { method: "POST" }), undefined);

    const lines = loggedLines();
    expect(lines).toHaveLength(1);
    expect(Object.keys(lines[0]).sort()).toEqual(["durationMs", "method", "path", "status", "time"]);
    expect(lines[0]).toMatchObject({ method: "POST", path: "/api/items", status: 201 });
    expect(lines[0].time).toBe(new Date(lines[0].time as string).toISOString());
    expect(Number.isInteger(lines[0].durationMs)).toBe(true);
    expect(lines[0].durationMs).toBeGreaterThanOrEqual(0);
  });

  it("logs only the path and none of the query, header, cookie or body values", async () => {
    const queryValue = "abc123";
    const authValue = "Bearer secret-auth-value";
    const cookieValue = "session=secret-cookie-value";
    const bodyValue = "secret-body-value";
    const route = apiRoute(() => Response.json({ ok: true }));

    await route(
      new Request(`http://localhost/api/x?token=${queryValue}`, {
        method: "POST",
        headers: { Authorization: authValue, Cookie: cookieValue, "Content-Type": "application/json" },
        body: JSON.stringify({ password: bodyValue }),
      }),
      undefined,
    );

    const lines = loggedLines();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ method: "POST", path: "/api/x", status: 200 });
    const text = loggedText();
    for (const value of [
      queryValue,
      "token=",
      authValue,
      "secret-auth-value",
      cookieValue,
      "secret-cookie-value",
      bodyValue,
      "password",
    ]) {
      expect(text).not.toContain(value);
    }
  });

  it("logs a 500 timing line and a separate error line with only the error name on an unexpected throw", async () => {
    const detail = "connection to secret-host failed";
    const route = apiRoute(() => {
      throw new TypeError(detail);
    });

    const response = await route(new Request("http://localhost/api/boom"), undefined);

    expect(response.status).toBe(500);
    const lines = loggedLines();
    expect(lines).toHaveLength(2);
    const timing = lines.filter((line) => "status" in line);
    expect(timing).toHaveLength(1);
    expect(timing[0]).toMatchObject({ method: "GET", path: "/api/boom", status: 500 });
    const errors = lines.filter((line) => line.level === "error");
    expect(errors).toHaveLength(1);
    expect(Object.keys(errors[0]).sort()).toEqual(["error", "level", "method", "path", "time"]);
    expect(errors[0]).toMatchObject({ method: "GET", path: "/api/boom", error: "TypeError" });
    expect(loggedText()).not.toContain(detail);
  });
});

describe("apiRoute error shape", () => {
  beforeEach(() => {
    writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function answer(error: unknown): Promise<Response> {
    const route = apiRoute(() => {
      throw error;
    });
    return route(new Request("http://localhost/api/thing"), undefined);
  }

  it.each([
    [401, "Sign in to continue."],
    [403, "You don't have permission to do that."],
    [404, "Not found"],
  ])("answers a thrown ApiError(%i) with that status and the error shape", async (status, message) => {
    const response = await answer(new ApiError(status, message));

    expect(response.status).toBe(status);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual({ error: { message } });
  });

  it("answers a thrown ApiError(422) with the field messages", async () => {
    const response = await answer(
      new ApiError(422, "Check the highlighted fields.", { name: "Enter a name." }),
    );

    expect(response.status).toBe(422);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual({
      error: { message: "Check the highlighted fields.", fields: { name: "Enter a name." } },
    });
  });

  it.each([
    ["an Error", new Error("relation secret_table does not exist")],
    ["a non-Error value", "secret string thrown"],
  ])("answers %s with 500 and no internal detail", async (_label, error) => {
    const response = await answer(error);

    expect(response.status).toBe(500);
    expect(response.headers.get("content-type")).toContain("application/json");
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({ error: { message: "Something went wrong." } });
    for (const value of ["secret", "stack", "    at "]) {
      expect(text).not.toContain(value);
    }
  });
});
describe("apiRoute cross-site check", () => {
  const forbidden = { error: { message: "You don't have permission to do that." } };
  const writeMethods = ["POST", "PUT", "PATCH", "DELETE"];

  beforeEach(() => {
    writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function send(method: string, headers: Record<string, string>) {
    const handler = vi.fn(() => Response.json({ ok: true }));
    const route = apiRoute(handler);
    const response = await route(
      new Request("http://localhost:3000/api/things", { method, headers }),
      undefined,
    );
    return { response, handler };
  }

  for (const method of writeMethods) {
    it.each(["cross-site", "same-site", "none"])(
      `answers ${method} with Sec-Fetch-Site %s with 403 and does not call the handler`,
      async (site) => {
        const { response, handler } = await send(method, { "Sec-Fetch-Site": site });

        expect(response.status).toBe(403);
        expect(await response.json()).toEqual(forbidden);
        expect(handler).not.toHaveBeenCalled();
      },
    );

    it(`lets ${method} with Sec-Fetch-Site same-origin through`, async () => {
      const { response, handler } = await send(method, { "Sec-Fetch-Site": "same-origin" });

      expect(response.status).toBe(200);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it(`answers ${method} without Sec-Fetch-Site and with another Origin with 403`, async () => {
      const { response, handler } = await send(method, { Origin: "https://evil.example" });

      expect(response.status).toBe(403);
      expect(await response.json()).toEqual(forbidden);
      expect(handler).not.toHaveBeenCalled();
    });

    it(`lets ${method} without Sec-Fetch-Site and with the app's Origin through`, async () => {
      const { response, handler } = await send(method, { Origin: "http://localhost:3000" });

      expect(response.status).toBe(200);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it(`lets ${method} with neither Sec-Fetch-Site nor Origin through`, async () => {
      const { response, handler } = await send(method, {});

      expect(response.status).toBe(200);
      expect(handler).toHaveBeenCalledTimes(1);
    });
  }

  it("lets GET with Sec-Fetch-Site cross-site through", async () => {
    const { response, handler } = await send("GET", { "Sec-Fetch-Site": "cross-site" });

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("still writes the request log line for a refused request", async () => {
    await send("POST", { "Sec-Fetch-Site": "cross-site" });

    const lines = loggedLines();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ method: "POST", path: "/api/things", status: 403 });
  });
});