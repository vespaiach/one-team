import { describe, expect, it, vi } from "vitest";

describe("db (build-time safety)", () => {
  it("throws when imported without DATABASE_URL set outside a production build", async () => {
    const original = process.env.DATABASE_URL;
    Reflect.deleteProperty(process.env, "DATABASE_URL");
    vi.resetModules();

    try {
      await expect(import("./index")).rejects.toThrow("DATABASE_URL is not set");
    } finally {
      process.env.DATABASE_URL = original;
      vi.resetModules();
    }
  });

  it("does not throw when imported without DATABASE_URL during a production build", async () => {
    const original = process.env.DATABASE_URL;
    Reflect.deleteProperty(process.env, "DATABASE_URL");
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    vi.resetModules();

    try {
      await expect(import("./index")).resolves.toBeDefined();
    } finally {
      process.env.DATABASE_URL = original;
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
});