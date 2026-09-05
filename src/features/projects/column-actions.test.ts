import { asc, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { activity, boardColumn, project, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { issueSession, SESSION_COOKIE_NAME } from "@/features/auth/server/sessions";
import { SEED_COLUMNS } from "./seed-columns";

const { cookiesMock, refreshMock, redirectMock, notFoundMock, loadProjectByKeySpy } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  refreshMock: vi.fn(),
  redirectMock: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  notFoundMock: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  loadProjectByKeySpy: vi.fn(),
}));

let currentOrigin: string | undefined = "https://app.example.com";

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
  headers: async () => new Headers(currentOrigin ? { origin: currentOrigin } : {}),
}));

vi.mock("next/navigation", () => ({ redirect: redirectMock, notFound: notFoundMock }));

vi.mock("next/cache", () => ({ refresh: refreshMock }));

vi.mock("@/features/projects/server/queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./server/queries")>();
  return {
    ...actual,
    loadProjectByKey: (key: string) => {
      loadProjectByKeySpy(key);
      return actual.loadProjectByKey(key);
    },
  };
});

const { createColumn, updateColumn, moveColumn, deleteColumn } = await import("./column-actions");

beforeEach(async () => {
  await truncateTestDatabase();
  process.env.APP_URL = "https://app.example.com";
  currentOrigin = "https://app.example.com";
  cookiesMock.mockReset();
  refreshMock.mockReset();
  redirectMock.mockClear();
  notFoundMock.mockClear();
  loadProjectByKeySpy.mockClear();
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

async function signInAs(role: "admin" | "member") {
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
    throw new Error("signInAs produced no user row");
  }
  const { token } = await issueSession({ userId: row.id, ipAddress: "203.0.113.4", userAgent: null });
  mockCookie(token);
  return row;
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

async function columnNamed(projectId: string, name: string) {
  const rows = await testDb
    .select()
    .from(boardColumn)
    .where(eq(boardColumn.projectId, projectId))
    .orderBy(asc(boardColumn.sortOrder));
  const row = rows.find((column) => column.name === name);
  if (!row) {
    throw new Error(`no column named ${name}`);
  }
  return row;
}

describe("createColumn action preamble (FR-007…FR-012, FR-053)", () => {
  it("asserts the origin before reading anything else", async () => {
    currentOrigin = "https://evil.example.com";
    mockCookie(undefined);

    await expect(createColumn({ projectKey: "WR", name: "Review" })).rejects.toThrow("forbidden_origin");
    expect(loadProjectByKeySpy).not.toHaveBeenCalled();
  });

  it("requires an actor before resolving the row", async () => {
    mockCookie(undefined);

    await expect(createColumn({ projectKey: "WR", name: "Review" })).rejects.toThrow("NEXT_REDIRECT:/signin");
    expect(loadProjectByKeySpy).not.toHaveBeenCalled();
  });

  it("resolves the row before the admin check — an unknown key is notFound() for a non-admin, never forbidden", async () => {
    await signInAs("member");

    await expect(createColumn({ projectKey: "ZZZZZZZZ", name: "Review" })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it("refuses a malformed project key as notFound() before loadProjectByKey runs", async () => {
    await signInAs("admin");

    await expect(createColumn({ projectKey: "not-a-key", name: "Review" })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(loadProjectByKeySpy).not.toHaveBeenCalled();
  });

  it("refuses a non-admin on a real project with forbidden and refreshes nothing", async () => {
    await signInAs("member");
    const proj = await insertSeededProject();

    expect(await createColumn({ projectKey: proj.key, name: "Review" })).toEqual({
      ok: false,
      error: "forbidden",
    });
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("validates the name on the server and refreshes nothing when it is refused", async () => {
    await signInAs("admin");
    const proj = await insertSeededProject();

    expect(await createColumn({ projectKey: proj.key, name: "   " })).toEqual({
      ok: false,
      error: "invalid_name",
      reason: "required",
    });
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("creates the column and refreshes on success", async () => {
    const admin = await signInAs("admin");
    const proj = await insertSeededProject();

    const result = await createColumn({ projectKey: proj.key, name: "Review" });

    expect(result.ok).toBe(true);
    expect(refreshMock).toHaveBeenCalledTimes(1);
    const created = await columnNamed(proj.id, "Review");
    expect(created.kind).toBe("open");
    const rows = await testDb.select().from(activity).where(eq(activity.projectId, proj.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.actorId).toBe(admin.id);
  });
});

describe("updateColumn action preamble (FR-007…FR-012, FR-053)", () => {
  it("asserts the origin before reading anything else", async () => {
    currentOrigin = "https://evil.example.com";
    mockCookie(undefined);

    await expect(updateColumn({ columnId: crypto.randomUUID(), name: "Up next" })).rejects.toThrow(
      "forbidden_origin",
    );
  });

  it("requires an actor", async () => {
    mockCookie(undefined);

    await expect(updateColumn({ columnId: crypto.randomUUID(), name: "Up next" })).rejects.toThrow(
      "NEXT_REDIRECT:/signin",
    );
  });

  it("resolves the row before the admin check — an unknown column is notFound() for a non-admin", async () => {
    await signInAs("member");

    await expect(updateColumn({ columnId: crypto.randomUUID(), name: "Up next" })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });

  it("refuses a malformed column id as notFound(), never as a PostgreSQL 22P02", async () => {
    await signInAs("admin");

    const thrown = await updateColumn({ columnId: "not-a-uuid", name: "Up next" }).then(
      () => null,
      (error: Error) => error,
    );

    expect(thrown?.message).toBe("NEXT_NOT_FOUND");
    expect(JSON.stringify(thrown)).not.toContain("22P02");
  });

  it("refuses a non-admin with forbidden and refreshes nothing", async () => {
    await signInAs("member");
    const proj = await insertSeededProject();
    const todo = await columnNamed(proj.id, "Todo");

    expect(await updateColumn({ columnId: todo.id, name: "Up next" })).toEqual({
      ok: false,
      error: "forbidden",
    });
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("renames and refreshes on success", async () => {
    await signInAs("admin");
    const proj = await insertSeededProject();
    const todo = await columnNamed(proj.id, "Todo");

    expect(await updateColumn({ columnId: todo.id, name: "Up next" })).toEqual({ ok: true });
    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect((await columnNamed(proj.id, "Up next")).id).toBe(todo.id);
  });

  it("derives projectId from the stored row and never from a client-supplied project id", async () => {
    await signInAs("admin");
    const other = await insertSeededProject();
    const proj = await insertSeededProject();
    const todo = await columnNamed(proj.id, "Todo");

    await updateColumn({ columnId: todo.id, name: "Up next", projectId: other.id } as {
      columnId: string;
      name: string;
    });

    const rows = await testDb.select().from(activity);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.projectId).toBe(proj.id);
  });
});
describe("moveColumn action preamble (FR-007…FR-012, FR-053)", () => {
  async function boardOrder(projectId: string) {
    const rows = await testDb
      .select()
      .from(boardColumn)
      .where(eq(boardColumn.projectId, projectId))
      .orderBy(asc(boardColumn.sortOrder), asc(boardColumn.id));
    return rows.map((row) => row.name);
  }

  it("asserts the origin before reading anything else", async () => {
    currentOrigin = "https://evil.example.com";
    mockCookie(undefined);

    await expect(
      moveColumn({ columnId: crypto.randomUUID(), targetColumnId: crypto.randomUUID(), placement: "after" }),
    ).rejects.toThrow("forbidden_origin");
  });

  it("requires an actor", async () => {
    mockCookie(undefined);

    await expect(
      moveColumn({ columnId: crypto.randomUUID(), targetColumnId: crypto.randomUUID(), placement: "after" }),
    ).rejects.toThrow("NEXT_REDIRECT:/signin");
  });

  it("resolves the row before the admin check — an unknown column is notFound() for a non-admin", async () => {
    await signInAs("member");

    await expect(
      moveColumn({ columnId: crypto.randomUUID(), targetColumnId: crypto.randomUUID(), placement: "after" }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("refuses a malformed column id as notFound(), never as a PostgreSQL 22P02", async () => {
    await signInAs("admin");

    const thrown = await moveColumn({
      columnId: "not-a-uuid",
      targetColumnId: crypto.randomUUID(),
      placement: "after",
    }).then(
      () => null,
      (error: Error) => error,
    );

    expect(thrown?.message).toBe("NEXT_NOT_FOUND");
    expect(JSON.stringify(thrown)).not.toContain("22P02");
  });

  it("refuses a malformed target column id as not_found, never as invalid_target", async () => {
    await signInAs("admin");
    const proj = await insertSeededProject();
    const todo = await columnNamed(proj.id, "Todo");

    expect(await moveColumn({ columnId: todo.id, targetColumnId: "not-a-uuid", placement: "after" })).toEqual(
      { ok: false, error: "not_found" },
    );
    expect(await boardOrder(proj.id)).toEqual(SEED_COLUMNS.map((column) => column.name));
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("refuses a placement that is neither before nor after — never defaulted to after, never coerced", async () => {
    await signInAs("admin");
    const proj = await insertSeededProject();
    const todo = await columnNamed(proj.id, "Todo");
    const canceled = await columnNamed(proj.id, "Canceled");

    const placement: string = "sideways";

    expect(
      await moveColumn({ columnId: todo.id, targetColumnId: canceled.id, placement } as {
        columnId: string;
        targetColumnId: string;
        placement: "before" | "after";
      }),
    ).toEqual({ ok: false, error: "invalid_input" });
    expect(await boardOrder(proj.id)).toEqual(SEED_COLUMNS.map((column) => column.name));
    expect(await testDb.select().from(activity)).toHaveLength(0);
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("refuses a non-admin with forbidden and refreshes nothing", async () => {
    await signInAs("member");
    const proj = await insertSeededProject();
    const todo = await columnNamed(proj.id, "Todo");
    const canceled = await columnNamed(proj.id, "Canceled");

    expect(await moveColumn({ columnId: todo.id, targetColumnId: canceled.id, placement: "after" })).toEqual({
      ok: false,
      error: "forbidden",
    });
    expect(await boardOrder(proj.id)).toEqual(SEED_COLUMNS.map((column) => column.name));
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("moves the column and refreshes on success, deriving the project from the stored row", async () => {
    const admin = await signInAs("admin");
    const other = await insertSeededProject();
    const proj = await insertSeededProject();
    const todo = await columnNamed(proj.id, "Todo");
    const canceled = await columnNamed(proj.id, "Canceled");

    expect(await moveColumn({ columnId: todo.id, targetColumnId: canceled.id, placement: "after" })).toEqual({
      ok: true,
    });
    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(await boardOrder(proj.id)).toEqual(["Backlog", "In Progress", "Done", "Canceled", "Todo"]);
    expect(await boardOrder(other.id)).toEqual(SEED_COLUMNS.map((column) => column.name));

    const rows = await testDb.select().from(activity);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.projectId).toBe(proj.id);
    expect(rows[0]?.actorId).toBe(admin.id);
  });

  it("takes no project key — a target in another project is invalid_target and writes nothing", async () => {
    await signInAs("admin");
    const other = await insertSeededProject();
    const proj = await insertSeededProject();
    const todo = await columnNamed(proj.id, "Todo");
    const elsewhere = await columnNamed(other.id, "Done");

    expect(await moveColumn({ columnId: todo.id, targetColumnId: elsewhere.id, placement: "after" })).toEqual(
      { ok: false, error: "invalid_target" },
    );
    expect(await boardOrder(proj.id)).toEqual(SEED_COLUMNS.map((column) => column.name));
    expect(await testDb.select().from(activity)).toHaveLength(0);
    expect(refreshMock).not.toHaveBeenCalled();
  });
});

describe("deleteColumn action preamble (FR-007…FR-012, FR-053, OT-UX-004)", () => {
  it("asserts the origin before reading anything else", async () => {
    currentOrigin = "https://evil.example.com";
    mockCookie(undefined);

    await expect(deleteColumn({ columnId: crypto.randomUUID() })).rejects.toThrow("forbidden_origin");
  });

  it("requires an actor", async () => {
    mockCookie(undefined);

    await expect(deleteColumn({ columnId: crypto.randomUUID() })).rejects.toThrow("NEXT_REDIRECT:/signin");
  });

  it("reports a column that is not there as already gone, never as forbidden and never as a refusal", async () => {
    await signInAs("member");

    await expect(deleteColumn({ columnId: crypto.randomUUID() })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it("refuses a malformed column id as notFound(), never as a PostgreSQL 22P02", async () => {
    await signInAs("admin");

    const thrown = await deleteColumn({ columnId: "not-a-uuid" }).then(
      () => null,
      (error: Error) => error,
    );

    expect(thrown?.message).toBe("NEXT_NOT_FOUND");
    expect(JSON.stringify(thrown)).not.toContain("22P02");
  });

  it("refuses a non-admin with forbidden, deletes nothing and refreshes nothing", async () => {
    await signInAs("member");
    const proj = await insertSeededProject();
    const todo = await columnNamed(proj.id, "Todo");

    expect(await deleteColumn({ columnId: todo.id })).toEqual({ ok: false, error: "forbidden" });
    expect(await columnNamed(proj.id, "Todo")).not.toBeNull();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("passes a refusal through as refused, writing nothing", async () => {
    await signInAs("admin");
    const proj = await insertSeededProject();
    const canceled = await columnNamed(proj.id, "Canceled");

    expect(await deleteColumn({ columnId: canceled.id })).toEqual({
      ok: false,
      error: "refused",
      refusal: "last_canceled_kind",
    });
    expect(await columnNamed(proj.id, "Canceled")).not.toBeNull();
    expect(await testDb.select().from(activity)).toHaveLength(0);
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("deletes the column and refreshes on success, deriving the project from the stored row", async () => {
    const admin = await signInAs("admin");
    const proj = await insertSeededProject();
    const todo = await columnNamed(proj.id, "Todo");

    expect(await deleteColumn({ columnId: todo.id })).toEqual({ ok: true });
    expect(refreshMock).toHaveBeenCalledTimes(1);
    await expect(columnNamed(proj.id, "Todo")).rejects.toThrow("no column named Todo");

    const rows = await testDb.select().from(activity);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.projectId).toBe(proj.id);
    expect(rows[0]?.actorId).toBe(admin.id);
  });

  it("reports the loser of two concurrent deletes as already gone, never forbidden and never a refusal", async () => {
    await signInAs("admin");
    const proj = await insertSeededProject();
    const todo = await columnNamed(proj.id, "Todo");

    const settled = await Promise.allSettled([
      deleteColumn({ columnId: todo.id }),
      deleteColumn({ columnId: todo.id }),
    ]);

    const committed = settled.filter((outcome) => outcome.status === "fulfilled" && outcome.value.ok);
    expect(committed).toHaveLength(1);

    for (const outcome of settled) {
      if (outcome.status === "rejected") {
        expect((outcome.reason as Error).message).toBe("NEXT_NOT_FOUND");
        continue;
      }
      expect(outcome.value).not.toEqual({ ok: false, error: "forbidden" });
      if (!outcome.value.ok) {
        expect(outcome.value).toEqual({ ok: false, error: "not_found" });
      }
    }
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });
});