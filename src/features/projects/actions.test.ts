import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { project, projectMember, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { issueSession, SESSION_COOKIE_NAME } from "@/features/auth/server/sessions";

const { cookiesMock, refreshMock, redirectMock, notFoundMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  refreshMock: vi.fn(),
  redirectMock: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  notFoundMock: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

let currentOrigin: string | undefined = "https://app.example.com";

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
  headers: async () => new Headers(currentOrigin ? { origin: currentOrigin } : {}),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  notFound: notFoundMock,
}));

vi.mock("next/cache", () => ({
  refresh: refreshMock,
}));

beforeEach(async () => {
  await truncateTestDatabase();
  process.env.APP_URL = "https://app.example.com";
  currentOrigin = "https://app.example.com";
  cookiesMock.mockReset();
  refreshMock.mockReset();
  redirectMock.mockClear();
  notFoundMock.mockClear();
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

async function signInAs(overrides: Partial<typeof user.$inferInsert> = {}) {
  const owner = await insertUser(overrides);
  const { token } = await issueSession({ userId: owner.id, ipAddress: "203.0.113.4", userAgent: null });
  mockCookie(token);
  return owner;
}

async function addMember(projectId: string, userId: string) {
  const now = new Date();
  await testDb.insert(projectMember).values({ projectId, userId, createdAt: now, updatedAt: now });
}

async function insertProject(overrides: Partial<typeof project.$inferInsert> = {}) {
  const now = new Date();
  const [row] = await testDb
    .insert(project)
    .values({
      key: `P${crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      name: "Existing Project",
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

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    name: "Website Redesign",
    key: "WR",
    description: null,
    startDate: null,
    targetDate: null,
    memberIds: [],
    ...overrides,
  };
}

describe("createProject (FR-014, FR-015, FR-024, FR-025, FR-028, FR-032, FR-034)", () => {
  it("asserts the origin before reading anything else", async () => {
    currentOrigin = undefined;
    const { createProject } = await import("./actions");

    await expect(createProject({ status: "idle" }, validInput())).rejects.toThrow("forbidden_origin");
  });

  it("redirects an unauthenticated caller to /signin", async () => {
    mockCookie(undefined);
    const { createProject } = await import("./actions");

    await expect(createProject({ status: "idle" }, validInput())).rejects.toThrow("NEXT_REDIRECT:/signin");
  });

  it("returns forbidden for a signed-in non-admin", async () => {
    await signInAs({ role: "member" });
    const { createProject } = await import("./actions");

    await expect(createProject({ status: "idle" }, validInput())).resolves.toEqual({ status: "forbidden" });
  });

  it("rejects an empty name before touching the database", async () => {
    await signInAs({ role: "admin" });
    const { createProject } = await import("./actions");

    const result = await createProject({ status: "idle" }, validInput({ name: "   " }));

    expect(result).toMatchObject({ status: "invalid", field: "name" });
    const rows = await testDb.select().from(project);
    expect(rows).toHaveLength(0);
  });

  it("rejects a key that fails the pattern before touching the database", async () => {
    await signInAs({ role: "admin" });
    const { createProject } = await import("./actions");

    const result = await createProject({ status: "idle" }, validInput({ key: "3R" }));

    expect(result).toMatchObject({ status: "invalid", field: "key" });
    const rows = await testDb.select().from(project);
    expect(rows).toHaveLength(0);
  });

  it("rejects a target date before the start date on blur, before touching the database", async () => {
    await signInAs({ role: "admin" });
    const { createProject } = await import("./actions");

    const result = await createProject(
      { status: "idle" },
      validInput({ startDate: "2026-06-10", targetDate: "2026-06-01" }),
    );

    expect(result).toMatchObject({ status: "invalid", field: "targetDate" });
    const rows = await testDb.select().from(project);
    expect(rows).toHaveLength(0);
  });

  it("returns key_taken naming the holder on a clash, applying no suffix", async () => {
    await signInAs({ role: "admin" });
    await insertProject({ key: "WR", name: "Website Redesign" });
    const { createProject } = await import("./actions");

    const result = await createProject({ status: "idle" }, validInput({ key: "WR", name: "Another Name" }));

    expect(result).toEqual({ status: "key_taken", holder: { key: "WR", name: "Website Redesign" } });
  });

  it("excludes the creating admin from memberIds even if the client sent it", async () => {
    const admin = await signInAs({ role: "admin" });
    const { createProject } = await import("./actions");

    await expect(createProject({ status: "idle" }, validInput({ memberIds: [admin.id] }))).rejects.toThrow(
      "NEXT_REDIRECT:/projects/WR",
    );

    const [createdProject] = await testDb.select().from(project).where(eq(project.key, "WR"));
    if (!createdProject) throw new Error("unreachable");
    const memberships = await testDb
      .select()
      .from(projectMember)
      .where(eq(projectMember.projectId, createdProject.id));
    expect(memberships).toHaveLength(0);
  });

  it("on success, refreshes and redirects to the new project's board route", async () => {
    await signInAs({ role: "admin" });
    const { createProject } = await import("./actions");

    await expect(createProject({ status: "idle" }, validInput())).rejects.toThrow(
      "NEXT_REDIRECT:/projects/WR",
    );
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("carries no SQL, no constraint name and no row in a refused result", async () => {
    await signInAs({ role: "member" });
    const { createProject } = await import("./actions");

    const result = await createProject({ status: "idle" }, validInput());

    expect(JSON.stringify(result)).not.toMatch(/select|insert|constraint/i);
  });
});

describe("checkProjectKeyAvailable (FR-026, D-5)", () => {
  it("asserts the origin before reading anything else", async () => {
    currentOrigin = undefined;
    const { checkProjectKeyAvailable } = await import("./actions");

    await expect(checkProjectKeyAvailable("WR")).rejects.toThrow("forbidden_origin");
  });

  it("redirects an unauthenticated caller to /signin", async () => {
    mockCookie(undefined);
    const { checkProjectKeyAvailable } = await import("./actions");

    await expect(checkProjectKeyAvailable("WR")).rejects.toThrow("NEXT_REDIRECT:/signin");
  });

  it("requires isAdmin, refusing a signed-in non-admin", async () => {
    await signInAs({ role: "member" });
    const { checkProjectKeyAvailable } = await import("./actions");

    await expect(checkProjectKeyAvailable("WR")).rejects.toThrow("forbidden");
  });

  it("returns the holder for a key that is taken", async () => {
    await signInAs({ role: "admin" });
    await insertProject({ key: "WR", name: "Website Redesign" });
    const { checkProjectKeyAvailable } = await import("./actions");

    await expect(checkProjectKeyAvailable("WR")).resolves.toEqual({
      holder: { key: "WR", name: "Website Redesign" },
    });
  });

  it("returns a null holder for a key that is available", async () => {
    await signInAs({ role: "admin" });
    const { checkProjectKeyAvailable } = await import("./actions");

    await expect(checkProjectKeyAvailable("WR")).resolves.toEqual({ holder: null });
  });
});

describe("updateProject (FR-014, FR-016, FR-028, FR-036)", () => {
  it("asserts the origin before reading anything else", async () => {
    currentOrigin = undefined;
    const { updateProject } = await import("./actions");

    await expect(updateProject({ projectKey: "WR", changes: { name: "Renamed" } })).rejects.toThrow(
      "forbidden_origin",
    );
  });

  it("redirects an unauthenticated caller to /signin", async () => {
    mockCookie(undefined);
    const { updateProject } = await import("./actions");

    await expect(updateProject({ projectKey: "WR", changes: { name: "Renamed" } })).rejects.toThrow(
      "NEXT_REDIRECT:/signin",
    );
  });

  it("rejects a changes object carrying an unknown key before touching the database", async () => {
    const member = await signInAs({ role: "member" });
    const proj = await insertProject();
    await addMember(proj.id, member.id);
    const { updateProject } = await import("./actions");

    const changes = { name: "Renamed", key: "HACKED" } as Record<string, unknown>;
    const result = await updateProject({ projectKey: proj.key, changes });

    expect(result).toEqual({ status: "forbidden" });
    const [row] = await testDb.select().from(project).where(eq(project.id, proj.id));
    expect(row?.name).toBe("Existing Project");
  });

  it("rejects an empty name before touching the database", async () => {
    const member = await signInAs({ role: "member" });
    const proj = await insertProject();
    await addMember(proj.id, member.id);
    const { updateProject } = await import("./actions");

    const result = await updateProject({ projectKey: proj.key, changes: { name: "   " } });

    expect(result).toMatchObject({ status: "invalid", field: "name" });
    const [row] = await testDb.select().from(project).where(eq(project.id, proj.id));
    expect(row?.name).toBe("Existing Project");
  });

  it("rejects a target date before the start date, sent together, before touching the database", async () => {
    const member = await signInAs({ role: "member" });
    const proj = await insertProject();
    await addMember(proj.id, member.id);
    const { updateProject } = await import("./actions");

    const result = await updateProject({
      projectKey: proj.key,
      changes: { startDate: "2026-06-10", targetDate: "2026-06-01" },
    });

    expect(result).toMatchObject({ status: "invalid", field: "targetDate" });
    const [row] = await testDb.select().from(project).where(eq(project.id, proj.id));
    expect(row?.startDate).toBeNull();
  });

  it("saves a valid name change for a member and refreshes", async () => {
    const member = await signInAs({ role: "member" });
    const proj = await insertProject();
    await addMember(proj.id, member.id);
    const { updateProject } = await import("./actions");

    const result = await updateProject({ projectKey: proj.key, changes: { name: "Renamed" } });

    expect(result).toEqual({ status: "saved" });
    expect(refreshMock).toHaveBeenCalledTimes(1);
    const [row] = await testDb.select().from(project).where(eq(project.id, proj.id));
    expect(row?.name).toBe("Renamed");
  });

  it("returns forbidden for a signed-in non-member", async () => {
    await signInAs({ role: "member" });
    const proj = await insertProject();
    const { updateProject } = await import("./actions");

    await expect(updateProject({ projectKey: proj.key, changes: { name: "Renamed" } })).resolves.toEqual({
      status: "forbidden",
    });
  });

  it("calls notFound() rather than forbidden() for a project the module did not find", async () => {
    await signInAs({ role: "admin" });
    const { updateProject } = await import("./actions");

    await expect(updateProject({ projectKey: "NOPE", changes: { name: "Renamed" } })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it("carries no SQL, no constraint name and no row in a refused result", async () => {
    await signInAs({ role: "member" });
    const proj = await insertProject();
    const { updateProject } = await import("./actions");

    const result = await updateProject({ projectKey: proj.key, changes: { name: "Renamed" } });

    expect(JSON.stringify(result)).not.toMatch(/select|insert|constraint/i);
  });
});

describe("addProjectMember (FR-014, FR-015, FR-045)", () => {
  it("asserts the origin before reading anything else", async () => {
    currentOrigin = undefined;
    const { addProjectMember } = await import("./actions");

    await expect(addProjectMember({ projectKey: "WR", userId: "any" })).rejects.toThrow("forbidden_origin");
  });

  it("redirects an unauthenticated caller to /signin", async () => {
    mockCookie(undefined);
    const { addProjectMember } = await import("./actions");

    await expect(addProjectMember({ projectKey: "WR", userId: "any" })).rejects.toThrow(
      "NEXT_REDIRECT:/signin",
    );
  });

  it("returns forbidden for a signed-in non-admin", async () => {
    await signInAs({ role: "member" });
    const { addProjectMember } = await import("./actions");

    await expect(addProjectMember({ projectKey: "WR", userId: "any" })).resolves.toEqual({
      status: "forbidden",
    });
  });

  it("calls notFound() rather than forbidden() for a project the module did not find", async () => {
    await signInAs({ role: "admin" });
    const { addProjectMember } = await import("./actions");

    await expect(addProjectMember({ projectKey: "NOPE", userId: "any" })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it("adds the member to the project derived from the stored row, and refreshes", async () => {
    await signInAs({ role: "admin" });
    const proj = await insertProject();
    const target = await insertUser({ firstName: "Grace", lastName: "Hopper" });
    const { addProjectMember } = await import("./actions");

    const result = await addProjectMember({ projectKey: proj.key, userId: target.id });

    expect(result).toEqual({ status: "saved" });
    expect(refreshMock).toHaveBeenCalledTimes(1);
    const memberships = await testDb.select().from(projectMember).where(eq(projectMember.projectId, proj.id));
    expect(memberships.map((row) => row.userId)).toEqual([target.id]);
  });
});

describe("removeProjectMember (FR-014, FR-015, FR-019)", () => {
  it("asserts the origin before reading anything else", async () => {
    currentOrigin = undefined;
    const { removeProjectMember } = await import("./actions");

    await expect(removeProjectMember({ projectKey: "WR", userId: "any" })).rejects.toThrow(
      "forbidden_origin",
    );
  });

  it("redirects an unauthenticated caller to /signin", async () => {
    mockCookie(undefined);
    const { removeProjectMember } = await import("./actions");

    await expect(removeProjectMember({ projectKey: "WR", userId: "any" })).rejects.toThrow(
      "NEXT_REDIRECT:/signin",
    );
  });

  it("returns forbidden for a signed-in non-admin", async () => {
    await signInAs({ role: "member" });
    const { removeProjectMember } = await import("./actions");

    await expect(removeProjectMember({ projectKey: "WR", userId: "any" })).resolves.toEqual({
      status: "forbidden",
    });
  });

  it("calls notFound() rather than forbidden() for a project the module did not find", async () => {
    await signInAs({ role: "admin" });
    const { removeProjectMember } = await import("./actions");

    await expect(removeProjectMember({ projectKey: "NOPE", userId: "any" })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it("removes the member from the project derived from the stored row, and refreshes", async () => {
    await signInAs({ role: "admin" });
    const proj = await insertProject();
    const target = await insertUser({ firstName: "Grace", lastName: "Hopper" });
    await addMember(proj.id, target.id);
    const { removeProjectMember } = await import("./actions");

    const result = await removeProjectMember({ projectKey: proj.key, userId: target.id });

    expect(result).toEqual({ status: "saved" });
    expect(refreshMock).toHaveBeenCalledTimes(1);
    const memberships = await testDb.select().from(projectMember).where(eq(projectMember.projectId, proj.id));
    expect(memberships).toHaveLength(0);
  });
});