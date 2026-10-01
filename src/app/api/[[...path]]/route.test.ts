import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import * as route from "./route.ts";

let writeSpy: MockInstance<typeof process.stdout.write>;

function loggedLines(): Record<string, unknown>[] {
  return writeSpy.mock.calls
    .map((call) => String(call[0]))
    .join("")
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

const methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;

const paths = [
  { path: "/api/nope/deeper", segments: ["nope", "deeper"] },
  { path: "/api", segments: undefined },
  { path: "/api/", segments: undefined },
];

describe("api catch-all", () => {
  beforeEach(() => {
    writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  for (const method of methods) {
    for (const { path, segments } of paths) {
      it(`${method} ${path} answers a JSON 404 and logs one timing line`, async () => {
        const handler = route[method];

        const response = await handler(new Request(`http://localhost${path}`, { method }), {
          params: Promise.resolve({ path: segments }),
        });

        expect(response.status).toBe(404);
        expect(response.headers.get("content-type")).toContain("application/json");
        expect(await response.json()).toEqual({ error: { message: "Not found" } });
        const lines = loggedLines();
        expect(lines).toHaveLength(1);
        expect(lines[0]).toMatchObject({ method, path, status: 404 });
      });
    }
  }
});