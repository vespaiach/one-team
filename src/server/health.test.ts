import { describe, expect, it } from "vitest";
import { checkHealth } from "./health.ts";

describe("checkHealth", () => {
  it("answers 200 ok when the query succeeds", async () => {
    const response = await checkHealth(async () => [{ "?column?": 1 }]);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe(JSON.stringify({ status: "ok" }));
  });

  it("answers 503 unavailable without detail when the query fails", async () => {
    const response = await checkHealth(async () => {
      throw new Error("connect ECONNREFUSED secret-host:5432");
    });

    expect(response.status).toBe(503);
    expect(await response.text()).toBe(JSON.stringify({ status: "unavailable" }));
  });

  it("answers 503 unavailable within 1 s when the query never settles", async () => {
    const started = performance.now();

    const response = await checkHealth(() => new Promise(() => {}));

    expect(performance.now() - started).toBeLessThan(1000);
    expect(response.status).toBe(503);
    expect(await response.text()).toBe(JSON.stringify({ status: "unavailable" }));
  });
});