import { afterAll, afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { db } from "../../server/db.ts";
import { GET } from "./route.ts";

let writeSpy: MockInstance<typeof process.stdout.write>;

function loggedLines(): Record<string, unknown>[] {
  return writeSpy.mock.calls
    .map((call) => String(call[0]))
    .join("")
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

describe("GET /health", () => {
  beforeEach(() => {
    writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.doUnmock("../../server/db.ts");
    vi.resetModules();
  });

  afterAll(async () => {
    await db().$client.end();
  });

  it("answers 200 ok against the test database and logs one line", async () => {
    const response = await GET(new Request("http://localhost/health"), undefined);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe(JSON.stringify({ status: "ok" }));
    const lines = loggedLines();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ method: "GET", path: "/health", status: 200 });
  });

  it("answers 503 unavailable when the database query fails and logs one line", async () => {
    vi.resetModules();
    vi.doMock("../../server/db.ts", () => ({
      db: () => () => Promise.reject(new Error("connect ECONNREFUSED")),
    }));
    const route = await import("./route.ts");

    const response = await route.GET(new Request("http://localhost/health"), undefined);

    expect(response.status).toBe(503);
    expect(await response.text()).toBe(JSON.stringify({ status: "unavailable" }));
    const lines = loggedLines();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ method: "GET", path: "/health", status: 503 });
  });
});