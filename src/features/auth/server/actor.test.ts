import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { issueSession, SESSION_COOKIE_NAME } from "./sessions";

const { cookiesMock } = vi.hoisted(() => ({ cookiesMock: vi.fn() }));

vi.mock("next/headers", () => ({ cookies: cookiesMock }));

beforeEach(async () => {
  await truncateTestDatabase();
  cookiesMock.mockReset();
});

afterEach(() => {
  vi.resetModules();
});

function mockCookie(token: string | undefined): void {
  cookiesMock.mockResolvedValue({
    get: (name: string) =>
      name === SESSION_COOKIE_NAME && token !== undefined ? { value: token } : undefined,
  });
}

async function insertUser(overrides: Partial<typeof user.$inferInsert> = {}) {
  const now = new Date();
  const [row] = await testDb
    .insert(user)
    .values({
      firstName: "Ada",
      lastName: "Lovelace",
      email: `ada-${crypto.randomUUID()}@example.com`,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    })
    .returning();
  if (!row) {
    throw new Error("insertUser produced no row");
  }
  return row;
}

describe("loadActor (FR-009, FR-020, FR-021)", () => {
  it("reads the session row and the user's role and deactivated_at in one query, resolving to the actor", async () => {
    const owner = await insertUser();
    const { token } = await issueSession({ userId: owner.id, ipAddress: "203.0.113.4", userAgent: null });
    mockCookie(token);

    const { loadActor } = await import("./actor");
    const selectSpy = vi.spyOn(db, "select");

    const actor = await loadActor();

    expect(selectSpy).toHaveBeenCalledTimes(1);
    expect(actor).toEqual({
      id: owner.id,
      role: owner.role,
      firstName: owner.firstName,
      lastName: owner.lastName,
      avatarUrl: owner.avatarUrl,
      mustChangePassword: owner.mustChangePassword,
    });

    selectSpy.mockRestore();
  });

  it("reads avatarUrl and mustChangePassword from the same query, in one round trip (FR-017, FR-026)", async () => {
    const owner = await insertUser({ avatarUrl: "https://example.com/ada.png", mustChangePassword: true });
    const { token } = await issueSession({ userId: owner.id, ipAddress: "203.0.113.4", userAgent: null });
    mockCookie(token);

    const { loadActor } = await import("./actor");

    const actor = await loadActor();

    expect(actor?.avatarUrl).toBe("https://example.com/ada.png");
    expect(actor?.mustChangePassword).toBe(true);
  });

  it("resolves avatarUrl to null when the user has none set (FR-017 edge case)", async () => {
    const owner = await insertUser({ avatarUrl: null });
    const { token } = await issueSession({ userId: owner.id, ipAddress: "203.0.113.4", userAgent: null });
    mockCookie(token);

    const { loadActor } = await import("./actor");

    const actor = await loadActor();

    expect(actor?.avatarUrl).toBeNull();
  });

  it("resolves to no actor for a cookie naming no session row", async () => {
    mockCookie("not-a-real-token");

    const { loadActor } = await import("./actor");

    await expect(loadActor()).resolves.toBeNull();
  });

  it("resolves to no actor when no session cookie is present", async () => {
    mockCookie(undefined);

    const { loadActor } = await import("./actor");

    await expect(loadActor()).resolves.toBeNull();
  });

  it("resolves to no actor for a session past its expiry", async () => {
    const owner = await insertUser();
    const longAgo = new Date("2020-01-01T00:00:00.000Z");
    const { token } = await issueSession({
      userId: owner.id,
      ipAddress: "203.0.113.4",
      userAgent: null,
      now: longAgo,
    });
    mockCookie(token);

    const { loadActor } = await import("./actor");

    await expect(loadActor()).resolves.toBeNull();
  });

  it("resolves to no actor for a user whose deactivated_at is set", async () => {
    const owner = await insertUser({ deactivatedAt: new Date() });
    const { token } = await issueSession({ userId: owner.id, ipAddress: "203.0.113.4", userAgent: null });
    mockCookie(token);

    const { loadActor } = await import("./actor");

    await expect(loadActor()).resolves.toBeNull();
  });

  it("holds no client-side copy: two independent module instances read the database fresh", async () => {
    const owner = await insertUser();
    const { token } = await issueSession({ userId: owner.id, ipAddress: "203.0.113.4", userAgent: null });
    mockCookie(token);

    const { loadActor: firstImport } = await import("./actor");
    await firstImport();

    await testDb.update(user).set({ firstName: "Grace" }).where(eq(user.id, owner.id));

    vi.resetModules();
    vi.doMock("next/headers", () => ({ cookies: cookiesMock }));
    const { loadActor: secondImport } = await import("./actor");
    const actor = await secondImport();

    expect(actor?.firstName).toBe("Grace");
  });
});

describe("requireActor (FR-022, SC-011, research B-2)", () => {
  it("redirects to /signin and never reaches the Forbidden screen", async () => {
    mockCookie(undefined);

    const { requireActor } = await import("./actor");

    await expect(requireActor()).rejects.toMatchObject({
      digest: expect.stringContaining(";/signin;") as string,
    });
  });

  it("two calls in one render pass share one query", async () => {
    vi.resetModules();
    vi.doMock("next/headers", () => ({ cookies: cookiesMock }));
    vi.doMock("react", async (importOriginal) => {
      const actual = await importOriginal<typeof import("react")>();
      return {
        ...actual,
        cache: <Args extends unknown[], Result>(fn: (...args: Args) => Result) => {
          let called = false;
          let cached: Result;
          return (...args: Args): Result => {
            if (!called) {
              cached = fn(...args);
              called = true;
            }
            return cached;
          };
        },
      };
    });

    const owner = await insertUser();
    const { token } = await issueSession({ userId: owner.id, ipAddress: "203.0.113.4", userAgent: null });
    mockCookie(token);

    const { loadActor } = await import("./actor");
    const { db: freshDb } = await import("@/db");
    const selectSpy = vi.spyOn(freshDb, "select");

    await loadActor();
    await loadActor();

    expect(selectSpy).toHaveBeenCalledTimes(1);
    selectSpy.mockRestore();
  });

  it("two requests do not share a query", async () => {
    const cacheFactory = async (importOriginal: <T>() => Promise<T>) => {
      const actual = await importOriginal<typeof import("react")>();
      return {
        ...actual,
        cache: <Args extends unknown[], Result>(fn: (...args: Args) => Result) => {
          let called = false;
          let cached: Result;
          return (...args: Args): Result => {
            if (!called) {
              cached = fn(...args);
              called = true;
            }
            return cached;
          };
        },
      };
    };

    const owner = await insertUser();
    const { token } = await issueSession({ userId: owner.id, ipAddress: "203.0.113.4", userAgent: null });
    mockCookie(token);

    vi.resetModules();
    vi.doMock("next/headers", () => ({ cookies: cookiesMock }));
    vi.doMock("react", cacheFactory);
    const firstRenderPass = await import("./actor");
    const firstDb = (await import("@/db")).db;
    await firstRenderPass.loadActor();

    vi.resetModules();
    vi.doMock("next/headers", () => ({ cookies: cookiesMock }));
    vi.doMock("react", cacheFactory);
    const secondRenderPass = await import("./actor");
    const secondDb = (await import("@/db")).db;
    const secondSpy = vi.spyOn(secondDb, "select");

    await secondRenderPass.loadActor();

    expect(secondSpy).toHaveBeenCalledTimes(1);
    expect(secondDb).not.toBe(firstDb);
    secondSpy.mockRestore();
  });
});