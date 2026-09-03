import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { project, projectMember, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { issueSession, SESSION_COOKIE_NAME } from "@/features/auth/server/sessions";

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

async function insertProject(overrides: Partial<typeof project.$inferInsert> = {}) {
  const now = new Date();
  const [row] = await testDb
    .insert(project)
    .values({
      key: `P${crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      name: "Website Redesign",
      createdAt: now,
      updatedAt: now,
      ...overrides,
    })
    .returning();
  if (!row) {
    throw new Error("insertProject produced no row");
  }
  return row;
}

async function addMember(projectId: string, userId: string) {
  const now = new Date();
  await testDb.insert(projectMember).values({ projectId, userId, createdAt: now, updatedAt: now });
}

async function signInAs(overrides: Partial<typeof user.$inferInsert> = {}) {
  const owner = await insertUser(overrides);
  const { token } = await issueSession({ userId: owner.id, ipAddress: "203.0.113.4", userAgent: null });
  mockCookie(token);
  return owner;
}

describe("isMember (FR-013, research B-1)", () => {
  it("admits every admin without querying project_member", async () => {
    const admin = await insertUser({ role: "admin" });
    const proj = await insertProject();
    const { isMember } = await import("./authorization");
    const { db } = await import("@/db");
    const selectSpy = vi.spyOn(db, "select");

    await expect(
      isMember(
        {
          id: admin.id,
          role: "admin",
          firstName: "Ada",
          lastName: "Lovelace",
          avatarUrl: null,
          mustChangePassword: false,
        },
        proj.id,
      ),
    ).resolves.toBe(true);
    expect(selectSpy).not.toHaveBeenCalled();
  });

  it("admits a member by row", async () => {
    const member = await insertUser({ role: "member" });
    const proj = await insertProject();
    await addMember(proj.id, member.id);
    const { isMember } = await import("./authorization");

    await expect(
      isMember(
        {
          id: member.id,
          role: "member",
          firstName: "Ada",
          lastName: "Lovelace",
          avatarUrl: null,
          mustChangePassword: false,
        },
        proj.id,
      ),
    ).resolves.toBe(true);
  });

  it("refuses a non-member", async () => {
    const nonMember = await insertUser({ role: "member" });
    const proj = await insertProject();
    const { isMember } = await import("./authorization");

    await expect(
      isMember(
        {
          id: nonMember.id,
          role: "member",
          firstName: "Ada",
          lastName: "Lovelace",
          avatarUrl: null,
          mustChangePassword: false,
        },
        proj.id,
      ),
    ).resolves.toBe(false);
  });
});

describe("requireAdmin (FR-014, FR-015)", () => {
  it("refuses an unauthenticated caller by redirecting to /signin", async () => {
    mockCookie(undefined);
    const { requireAdmin } = await import("./authorization");

    await expect(requireAdmin()).rejects.toMatchObject({
      digest: expect.stringContaining(";/signin;") as string,
    });
  });

  it("refuses a signed-in non-admin", async () => {
    await signInAs({ role: "member" });
    const { requireAdmin, ForbiddenActorError } = await import("./authorization");

    await expect(requireAdmin()).rejects.toBeInstanceOf(ForbiddenActorError);
  });

  it("admits a signed-in admin", async () => {
    const admin = await signInAs({ role: "admin" });
    const { requireAdmin } = await import("./authorization");

    await expect(requireAdmin()).resolves.toMatchObject({ id: admin.id, role: "admin" });
  });
});

describe("requireMember (FR-014, FR-016)", () => {
  it("refuses an unauthenticated caller by redirecting to /signin", async () => {
    mockCookie(undefined);
    const proj = await insertProject();
    const { requireMember } = await import("./authorization");

    await expect(requireMember(proj.id)).rejects.toMatchObject({
      digest: expect.stringContaining(";/signin;") as string,
    });
  });

  it("refuses a signed-in caller who is not a member of that project", async () => {
    await signInAs({ role: "member" });
    const proj = await insertProject();
    const { requireMember, ForbiddenActorError } = await import("./authorization");

    await expect(requireMember(proj.id)).rejects.toBeInstanceOf(ForbiddenActorError);
  });

  it("admits a signed-in member of that project", async () => {
    const member = await signInAs({ role: "member" });
    const proj = await insertProject();
    await addMember(proj.id, member.id);
    const { requireMember } = await import("./authorization");

    await expect(requireMember(proj.id)).resolves.toMatchObject({ id: member.id });
  });

  it("admits a signed-in admin who holds no membership row", async () => {
    const admin = await signInAs({ role: "admin" });
    const proj = await insertProject();
    const { requireMember } = await import("./authorization");

    await expect(requireMember(proj.id)).resolves.toMatchObject({ id: admin.id });
  });
});