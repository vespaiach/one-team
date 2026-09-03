import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { boardColumn, issue, project, projectMember, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import type { Actor } from "@/features/auth/server/actor";
import { issueSession, SESSION_COOKIE_NAME } from "@/features/auth/server/sessions";
import { createIssue } from "./create-issue";
import { updateIssue } from "./update-issue";

const { cookiesMock, redirectMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  redirectMock: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

let currentOrigin: string | undefined = "https://app.example.com";

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
  headers: async () => new Headers(currentOrigin ? { origin: currentOrigin } : {}),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("next/cache", () => ({
  refresh: vi.fn(),
}));

beforeEach(async () => {
  await truncateTestDatabase();
  process.env.APP_URL = "https://app.example.com";
  currentOrigin = "https://app.example.com";
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

async function signInAs(overrides: Partial<typeof user.$inferInsert> = {}) {
  const owner = await insertUser(overrides);
  const { token } = await issueSession({ userId: owner.id, ipAddress: "203.0.113.4", userAgent: null });
  mockCookie(token);
  return owner;
}

async function insertProjectWithColumnAndCounter(overrides: Partial<typeof project.$inferInsert> = {}) {
  const now = new Date();
  const [proj] = await testDb
    .insert(project)
    .values({
      key: `P${crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      name: "Website Redesign",
      createdAt: now,
      updatedAt: now,
      ...overrides,
    })
    .returning();
  if (!proj) {
    throw new Error("insertProject produced no row");
  }
  const [column] = await testDb
    .insert(boardColumn)
    .values({
      projectId: proj.id,
      name: "Backlog",
      kind: "open",
      sortOrder: "a0",
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!column) {
    throw new Error("insertColumn produced no row");
  }
  return { proj, column };
}

async function addMember(projectId: string, userId: string) {
  const now = new Date();
  await testDb.insert(projectMember).values({ projectId, userId, createdAt: now, updatedAt: now });
}

function actorFor(userRow: { id: string; role: string; firstName: string; lastName: string }): Actor {
  return {
    id: userRow.id,
    role: userRow.role,
    firstName: userRow.firstName,
    lastName: userRow.lastName,
    avatarUrl: null,
    mustChangePassword: false,
  };
}

async function insertIssue(projectId: string, columnId: string, createdBy: string) {
  const now = new Date();
  const [row] = await testDb
    .insert(issue)
    .values({
      projectId,
      number: 1,
      title: "Fix the header",
      columnId,
      createdBy,
      sortOrder: "a0",
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!row) {
    throw new Error("insertIssue produced no row");
  }
  return row;
}

describe("createIssue and updateIssue — a missing row answers as missing, never as a refusal (FR-019)", () => {
  it("createIssue answers not-found for a project id naming no row, even for an actor with no membership anywhere", async () => {
    const outsider = await insertUser();

    const result = await createIssue({
      projectId: crypto.randomUUID(),
      actor: actorFor(outsider),
      title: "Fix the header",
      description: null,
      columnId: null,
      priority: null,
      assigneeId: null,
      dueDate: null,
    });

    expect(result).toEqual({ status: "not-found" });
  });

  it("updateIssue answers not-found for an issue id naming no row, even for an actor with no membership anywhere", async () => {
    const outsider = await insertUser();

    const result = await updateIssue({
      issueId: crypto.randomUUID(),
      actor: actorFor(outsider),
      title: "Something else",
    });

    expect(result).toEqual({ status: "not-found" });
  });
});

describe("updateIssue derives its project from the stored issue, never from the caller (FR-019)", () => {
  it("refuses a caller who is a member of a different project than the one the issue actually belongs to", async () => {
    const { proj: home, column } = await insertProjectWithColumnAndCounter({ name: "Home Project" });
    const { proj: elsewhere } = await insertProjectWithColumnAndCounter({ name: "Elsewhere" });
    const created = await insertIssue(home.id, column.id, (await insertUser()).id);
    const elsewhereMember = await insertUser();
    await addMember(elsewhere.id, elsewhereMember.id);

    const result = await updateIssue({
      issueId: created.id,
      actor: actorFor(elsewhereMember),
      title: "Changed",
    });

    expect(result).toEqual({
      status: "forbidden",
      reason: "Only project members can edit issues in Home Project.",
    });
  });

  it("admits a member of the issue's own project regardless of who created the issue", async () => {
    const { proj, column } = await insertProjectWithColumnAndCounter();
    const creator = await insertUser();
    const otherMember = await insertUser();
    await addMember(proj.id, creator.id);
    await addMember(proj.id, otherMember.id);
    const created = await insertIssue(proj.id, column.id, creator.id);

    const result = await updateIssue({
      issueId: created.id,
      actor: actorFor(otherMember),
      title: "Edited by someone else entirely",
    });

    expect(result.status).toBe("ok");
  });
});

describe("createIssue derives its project from the route-resolved project row (FR-019)", () => {
  it("names the route-resolved project in its refusal, not any project the caller happens to belong to", async () => {
    const { proj: target } = await insertProjectWithColumnAndCounter({ name: "Target Project" });
    const { proj: elsewhere } = await insertProjectWithColumnAndCounter({ name: "Elsewhere" });
    const memberElsewhere = await insertUser();
    await addMember(elsewhere.id, memberElsewhere.id);

    const result = await createIssue({
      projectId: target.id,
      actor: actorFor(memberElsewhere),
      title: "Fix the header",
      description: null,
      columnId: null,
      priority: null,
      assigneeId: null,
      dueDate: null,
    });

    expect(result).toEqual({
      status: "forbidden",
      reason: "Only project members can create issues in Target Project.",
    });
  });
});

describe("a member may edit any issue in their project — no authorship check anywhere (FR-020)", () => {
  it("lets a member who did not create the issue change every field a creator could", async () => {
    const { proj, column } = await insertProjectWithColumnAndCounter();
    const creator = await insertUser();
    const editor = await insertUser();
    await addMember(proj.id, creator.id);
    await addMember(proj.id, editor.id);
    const created = await insertIssue(proj.id, column.id, creator.id);

    const result = await updateIssue({
      issueId: created.id,
      actor: actorFor(editor),
      title: "Retitled",
      priority: "urgent",
    });

    expect(result.status).toBe("ok");
    const [row] = await testDb.select().from(issue).where(eq(issue.id, created.id));
    expect(row?.title).toBe("Retitled");
    expect(row?.priority).toBe("urgent");
  });
});

describe("a caller with no session is refused by every mutator, independent of any route guard (FR-019)", () => {
  it("redirects to /signin before createIssue ever runs, when there is no session cookie at all", async () => {
    mockCookie(undefined);
    const { createIssue: createIssueAction } = await import("../actions");
    const formData = new FormData();
    formData.set("projectId", crypto.randomUUID());
    formData.set("title", "Fix the header");

    await expect(createIssueAction({ status: "idle" }, formData)).rejects.toThrow("NEXT_REDIRECT:/signin");
  });

  it("redirects to /signin before updateIssue ever runs, when there is no session cookie at all", async () => {
    mockCookie(undefined);
    const { updateIssue: updateIssueAction } = await import("../actions");

    await expect(updateIssueAction({ issueId: crypto.randomUUID(), title: "Changed" })).rejects.toThrow(
      "NEXT_REDIRECT:/signin",
    );
  });
});

describe("a deactivated account resolves to no actor and reaches neither mutator (FR-019)", () => {
  it("redirects to /signin for createIssue when the session belongs to a deactivated account", async () => {
    const deactivated = await signInAs({ deactivatedAt: new Date() });
    const { createIssue: createIssueAction } = await import("../actions");
    const formData = new FormData();
    formData.set("projectId", crypto.randomUUID());
    formData.set("title", "Fix the header");

    await expect(createIssueAction({ status: "idle" }, formData)).rejects.toThrow("NEXT_REDIRECT:/signin");
    expect(deactivated.deactivatedAt).not.toBeNull();
  });

  it("redirects to /signin for updateIssue when the session belongs to a deactivated account", async () => {
    await signInAs({ deactivatedAt: new Date() });
    const { updateIssue: updateIssueAction } = await import("../actions");

    await expect(updateIssueAction({ issueId: crypto.randomUUID(), title: "Changed" })).rejects.toThrow(
      "NEXT_REDIRECT:/signin",
    );
  });
});