import { asc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { activity, boardColumn, project, projectMember, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { issueSession, SESSION_COOKIE_NAME } from "@/features/auth/server/sessions";
import { SEED_COLUMNS } from "./seed-columns";

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

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
  headers: async () => new Headers({ origin: "https://app.example.com" }),
}));

vi.mock("next/navigation", () => ({ redirect: redirectMock, notFound: notFoundMock }));

vi.mock("next/cache", () => ({ refresh: refreshMock }));

const { createColumn, updateColumn, moveColumn, deleteColumn } = await import("./column-actions");

beforeEach(async () => {
  await truncateTestDatabase();
  process.env.APP_URL = "https://app.example.com";
  cookiesMock.mockReset();
  refreshMock.mockReset();
  notFoundMock.mockClear();
});

async function insertUser(role: "admin" | "member") {
  const now = new Date();
  const [row] = await testDb
    .insert(user)
    .values({
      firstName: "Ada",
      lastName: "Lovelace",
      email: `ada-${crypto.randomUUID()}@example.com`,
      role,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!row) {
    throw new Error("insertUser produced no row");
  }
  return row;
}

async function signInAs(userId: string) {
  const { token } = await issueSession({ userId, ipAddress: "203.0.113.4", userAgent: null });
  cookiesMock.mockResolvedValue({
    get: (name: string) => (name === SESSION_COOKIE_NAME ? { value: token } : undefined),
  });
}

async function insertSeededProject() {
  const now = new Date(Date.now() - 60_000);
  const [row] = await testDb
    .insert(project)
    .values({
      key: `P${crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      name: "Website Redesign",
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!row) {
    throw new Error("insertSeededProject produced no row");
  }
  await testDb
    .insert(boardColumn)
    .values(SEED_COLUMNS.map((column) => ({ ...column, projectId: row.id, createdAt: now, updatedAt: now })));
  return row;
}

async function addMember(projectId: string, userId: string) {
  const now = new Date();
  await testDb.insert(projectMember).values({ projectId, userId, createdAt: now, updatedAt: now });
}

async function boardState() {
  return testDb.select().from(boardColumn).orderBy(asc(boardColumn.sortOrder), asc(boardColumn.id));
}

async function columnNamed(projectId: string, name: string) {
  const rows = await testDb.select().from(boardColumn).where(eq(boardColumn.projectId, projectId));
  const row = rows.find((column) => column.name === name);
  if (!row) {
    throw new Error(`no column named ${name}`);
  }
  return row;
}

async function setUpProjectMember() {
  const proj = await insertSeededProject();
  const caller = await insertUser("member");
  await addMember(proj.id, caller.id);
  await signInAs(caller.id);
  return proj;
}

async function setUpSignedInNonMember() {
  const proj = await insertSeededProject();
  const caller = await insertUser("member");
  await signInAs(caller.id);
  return proj;
}

const NON_ADMIN_CALLERS: [string, () => Promise<typeof project.$inferSelect>][] = [
  ["a project member", setUpProjectMember],
  ["a signed-in non-member", setUpSignedInNonMember],
];

describe.each(
  NON_ADMIN_CALLERS,
)("every column mutator refuses %s (FR-007, FR-011, FR-040, SC-009, US4-3)", (_caller, setUp) => {
  it("refuses createColumn, writing no column and no activity row", async () => {
    const proj = await setUp();
    const before = await boardState();

    expect(await createColumn({ projectKey: proj.key, name: "Review" })).toEqual({
      ok: false,
      error: "forbidden",
    });
    expect(await boardState()).toEqual(before);
    expect(await testDb.select().from(activity)).toHaveLength(0);
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("refuses updateColumn, writing no column and no activity row", async () => {
    const proj = await setUp();
    const todo = await columnNamed(proj.id, "Todo");
    const before = await boardState();

    expect(await updateColumn({ columnId: todo.id, name: "Up next" })).toEqual({
      ok: false,
      error: "forbidden",
    });
    expect(await boardState()).toEqual(before);
    expect(await testDb.select().from(activity)).toHaveLength(0);
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("refuses moveColumn, writing no column and no activity row", async () => {
    const proj = await setUp();
    const todo = await columnNamed(proj.id, "Todo");
    const canceled = await columnNamed(proj.id, "Canceled");
    const before = await boardState();

    expect(await moveColumn({ columnId: todo.id, targetColumnId: canceled.id, placement: "after" })).toEqual({
      ok: false,
      error: "forbidden",
    });
    expect(await boardState()).toEqual(before);
    expect(await testDb.select().from(activity)).toHaveLength(0);
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("refuses deleteColumn even where every delete restriction would have passed", async () => {
    const proj = await setUp();
    const todo = await columnNamed(proj.id, "Todo");
    const before = await boardState();

    expect(await deleteColumn({ columnId: todo.id })).toEqual({ ok: false, error: "forbidden" });
    expect(await boardState()).toEqual(before);
    expect(await testDb.select().from(activity)).toHaveLength(0);
    expect(refreshMock).not.toHaveBeenCalled();
  });
});

describe("an admin who is not a member of the project (FR-007, FR-009, research D-2)", () => {
  async function setUpAdminNonMember() {
    const proj = await insertSeededProject();
    const admin = await insertUser("admin");
    await signInAs(admin.id);
    expect(await testDb.select().from(projectMember).where(eq(projectMember.userId, admin.id))).toHaveLength(
      0,
    );
    return proj;
  }

  it("creates a column, membership never being a second condition", async () => {
    const proj = await setUpAdminNonMember();

    const result = await createColumn({ projectKey: proj.key, name: "Review" });

    expect(result).toEqual({
      ok: true,
      column: {
        id: expect.any(String) as string,
        name: "Review",
        kind: "open",
        position: 5,
        issueCount: 0,
        deleteRefusal: null,
      },
    });
    expect((await columnNamed(proj.id, "Review")).kind).toBe("open");
  });

  it("renames a column", async () => {
    const proj = await setUpAdminNonMember();
    const todo = await columnNamed(proj.id, "Todo");

    expect(await updateColumn({ columnId: todo.id, name: "Up next" })).toEqual({ ok: true });
    expect((await columnNamed(proj.id, "Up next")).id).toBe(todo.id);
  });

  it("reorders a column", async () => {
    const proj = await setUpAdminNonMember();
    const todo = await columnNamed(proj.id, "Todo");
    const canceled = await columnNamed(proj.id, "Canceled");

    expect(await moveColumn({ columnId: todo.id, targetColumnId: canceled.id, placement: "after" })).toEqual({
      ok: true,
    });
    const names = (await boardState())
      .filter((column) => column.projectId === proj.id)
      .map((column) => column.name);
    expect(names).toEqual(["Backlog", "In Progress", "Done", "Canceled", "Todo"]);
  });

  it("deletes a column", async () => {
    const proj = await setUpAdminNonMember();
    const todo = await columnNamed(proj.id, "Todo");

    expect(await deleteColumn({ columnId: todo.id })).toEqual({ ok: true });
    const names = (await boardState())
      .filter((column) => column.projectId === proj.id)
      .map((column) => column.name);
    expect(names).toEqual(["Backlog", "In Progress", "Done", "Canceled"]);
  });
});