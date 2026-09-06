import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { boardColumn, issueCounter, notification, project, projectMember, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import type { Actor } from "@/features/auth/server/actor";
import { issueSession, SESSION_COOKIE_NAME } from "@/features/auth/server/sessions";
import { createBoardCard } from "@/features/issues/actions";
import { createIssue } from "./create-issue";

const ORIGINAL_APP_URL = process.env.APP_URL;
const cookieJar = new Map<string, string>();

vi.mock("next/cache", () => ({
  refresh: () => undefined,
  revalidatePath: () => undefined,
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ origin: "https://app.example.com" }),
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { value: cookieJar.get(name) } : undefined),
    set: (name: string, value: string) => {
      cookieJar.set(name, value);
    },
    delete: (name: string) => {
      cookieJar.delete(name);
    },
  }),
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

beforeEach(async () => {
  await truncateTestDatabase();
  process.env.APP_URL = "https://app.example.com";
  cookieJar.clear();
});

afterEach(() => {
  process.env.APP_URL = ORIGINAL_APP_URL;
});

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

async function insertProjectWithColumnAndCounter() {
  const now = new Date();
  const [proj] = await testDb
    .insert(project)
    .values({
      key: `P${crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      name: "Website Redesign",
      createdAt: now,
      updatedAt: now,
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
  await testDb.insert(issueCounter).values({ projectId: proj.id, lastNumber: 0 });
  return { proj, column };
}

async function addMember(projectId: string, userId: string) {
  const now = new Date();
  await testDb.insert(projectMember).values({ projectId, userId, createdAt: now, updatedAt: now });
}

function actorFor(userRow: typeof user.$inferSelect): Actor {
  return {
    id: userRow.id,
    role: userRow.role,
    firstName: userRow.firstName,
    lastName: userRow.lastName,
    avatarUrl: null,
    mustChangePassword: false,
  };
}

async function census() {
  return testDb.select().from(notification);
}

describe("createIssue — assignment notifications (FR-050, FR-051, SC-003, SC-008)", () => {
  it("writes exactly one assignment row when the assignee is somebody other than the creator", async () => {
    const { proj } = await insertProjectWithColumnAndCounter();
    const creator = await insertUser();
    const assignee = await insertUser();
    await addMember(proj.id, creator.id);
    await addMember(proj.id, assignee.id);
    const before = await census();

    const result = await createIssue({
      projectId: proj.id,
      actor: actorFor(creator),
      title: "Fix the header",
      description: null,
      columnId: null,
      priority: null,
      assigneeId: assignee.id,
      dueDate: null,
    });

    expect(result.status).toBe("ok");
    const after = await census();
    expect(after).toHaveLength(before.length + 1);
    expect(after[0]).toMatchObject({
      userId: assignee.id,
      actorId: creator.id,
      type: "assignment",
      projectId: null,
      commentId: null,
    });
  });

  it("writes nothing when the creator assigns the issue to themselves", async () => {
    const { proj } = await insertProjectWithColumnAndCounter();
    const creator = await insertUser();
    await addMember(proj.id, creator.id);
    const before = await census();

    const result = await createIssue({
      projectId: proj.id,
      actor: actorFor(creator),
      title: "Fix the header",
      description: null,
      columnId: null,
      priority: null,
      assigneeId: creator.id,
      dueDate: null,
    });

    expect(result.status).toBe("ok");
    expect(await census()).toEqual(before);
  });

  it("writes nothing when the issue is created with no assignee", async () => {
    const { proj } = await insertProjectWithColumnAndCounter();
    const creator = await insertUser();
    await addMember(proj.id, creator.id);
    const before = await census();

    const result = await createIssue({
      projectId: proj.id,
      actor: actorFor(creator),
      title: "Fix the header",
      description: null,
      columnId: null,
      priority: null,
      assigneeId: null,
      dueDate: null,
    });

    expect(result.status).toBe("ok");
    expect(await census()).toEqual(before);
  });
});

describe("createBoardCard — the board's inline composer takes the same path (FR-050)", () => {
  it("writes the same single assignment row as createIssue", async () => {
    const { proj, column } = await insertProjectWithColumnAndCounter();
    const creator = await insertUser();
    const assignee = await insertUser();
    await addMember(proj.id, creator.id);
    await addMember(proj.id, assignee.id);
    const { token } = await issueSession({ userId: creator.id, ipAddress: "203.0.113.4", userAgent: null });
    cookieJar.set(SESSION_COOKIE_NAME, token);

    const result = await createBoardCard({
      projectId: proj.id,
      title: "Fix the header",
      columnId: column.id,
      priority: null,
      assigneeId: assignee.id,
    });

    expect(result.status).toBe("ok");
    const rows = await census();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId: assignee.id, actorId: creator.id, type: "assignment" });
  });
});