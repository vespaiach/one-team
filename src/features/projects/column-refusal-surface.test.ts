import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { boardColumn, issue, project, user } from "@/db/schema";
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

const CREATE_CODES = ["forbidden", "invalid_name", "duplicate_name"];
const UPDATE_CODES = ["forbidden", "invalid_name", "duplicate_name"];
const MOVE_CODES = ["forbidden", "not_found", "invalid_target", "invalid_input"];
const DELETE_CODES = ["forbidden", "not_found", "refused"];
const DELETE_REFUSALS = ["holds_issues", "last_column", "last_canceled_kind", "last_done_kind"];

const FORBIDDEN_FRAGMENTS = [
  "board_column_project_id_name_lower_idx",
  "23505",
  "22P02",
  "select ",
  "insert into",
  "delete from",
  "update ",
  "postgres",
  "error:",
  "stack",
  "node_modules",
  "DATABASE_URL",
  process.cwd(),
];

beforeEach(async () => {
  await truncateTestDatabase();
  process.env.APP_URL = "https://app.example.com";
  cookiesMock.mockReset();
  refreshMock.mockReset();
  notFoundMock.mockClear();
});

afterEach(() => {
  vi.resetModules();
});

function expectReasonCodeOnly(result: unknown, codes: string[]): Record<string, unknown> {
  expect(result).toBeTypeOf("object");
  const payload = result as Record<string, unknown>;
  expect(payload.ok).toBe(false);
  expect(codes).toContain(payload.error);

  for (const value of Object.values(payload)) {
    expect(value).not.toBeInstanceOf(Error);
  }

  const serialized = JSON.stringify(payload);
  expect(JSON.parse(serialized)).toEqual(payload);
  for (const fragment of FORBIDDEN_FRAGMENTS) {
    expect(serialized.toLowerCase()).not.toContain(fragment.toLowerCase());
  }
  expect(refreshMock).not.toHaveBeenCalled();

  return payload;
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
  cookiesMock.mockResolvedValue({
    get: (name: string) => (name === SESSION_COOKIE_NAME ? { value: token } : undefined),
  });
  return row;
}

async function insertProject() {
  const now = new Date();
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
    throw new Error("insertProject produced no row");
  }
  return row;
}

async function insertSeededProject() {
  const row = await insertProject();
  const now = new Date();
  await testDb
    .insert(boardColumn)
    .values(SEED_COLUMNS.map((column) => ({ ...column, projectId: row.id, createdAt: now, updatedAt: now })));
  return row;
}

async function columnNamed(projectId: string, name: string) {
  const rows = await testDb.select().from(boardColumn).where(eq(boardColumn.projectId, projectId));
  const row = rows.find((column) => column.name === name);
  if (!row) {
    throw new Error(`no column named ${name}`);
  }
  return row;
}

async function insertIssue(projectId: string, columnId: string, createdBy: string) {
  const now = new Date();
  await testDb.insert(issue).values({
    projectId,
    number: 1,
    title: "Fix the header",
    columnId,
    createdBy,
    sortOrder: "a0",
    createdAt: now,
    updatedAt: now,
  });
}

describe("createColumn returns reason codes and nothing else (FR-052, FR-053)", () => {
  it("refuses a non-admin with the forbidden code alone", async () => {
    await signInAs("member");
    const proj = await insertSeededProject();

    const payload = expectReasonCodeOnly(
      await createColumn({ projectKey: proj.key, name: "Review" }),
      CREATE_CODES,
    );
    expect(Object.keys(payload).sort()).toEqual(["error", "ok"]);
  });

  it("refuses an empty and an over-long name with a reason and no server detail", async () => {
    await signInAs("admin");
    const proj = await insertSeededProject();

    expect(
      expectReasonCodeOnly(await createColumn({ projectKey: proj.key, name: "  " }), CREATE_CODES),
    ).toEqual({ ok: false, error: "invalid_name", reason: "required" });
    expect(
      expectReasonCodeOnly(await createColumn({ projectKey: proj.key, name: "R".repeat(201) }), CREATE_CODES),
    ).toEqual({ ok: false, error: "invalid_name", reason: "too_long" });
  });

  it("reports a collision as duplicate_name carrying the stored name, never the constraint", async () => {
    await signInAs("admin");
    const proj = await insertSeededProject();
    const backlog = await columnNamed(proj.id, "Backlog");

    expect(
      expectReasonCodeOnly(await createColumn({ projectKey: proj.key, name: "backlog" }), CREATE_CODES),
    ).toEqual({ ok: false, error: "duplicate_name", holder: { id: backlog.id, name: "Backlog" } });
  });
});

describe("updateColumn returns reason codes and nothing else (FR-052, FR-053)", () => {
  it("refuses a non-admin, an empty name, an over-long name and a collision with codes alone", async () => {
    const proj = await insertSeededProject();
    const todo = await columnNamed(proj.id, "Todo");
    const backlog = await columnNamed(proj.id, "Backlog");

    await signInAs("member");
    expect(
      expectReasonCodeOnly(await updateColumn({ columnId: todo.id, name: "Up next" }), UPDATE_CODES),
    ).toEqual({ ok: false, error: "forbidden" });

    await signInAs("admin");
    expect(expectReasonCodeOnly(await updateColumn({ columnId: todo.id, name: " " }), UPDATE_CODES)).toEqual({
      ok: false,
      error: "invalid_name",
      reason: "required",
    });
    expect(
      expectReasonCodeOnly(await updateColumn({ columnId: todo.id, name: "U".repeat(201) }), UPDATE_CODES),
    ).toEqual({ ok: false, error: "invalid_name", reason: "too_long" });
    expect(
      expectReasonCodeOnly(await updateColumn({ columnId: todo.id, name: "backlog" }), UPDATE_CODES),
    ).toEqual({ ok: false, error: "duplicate_name", holder: { id: backlog.id, name: "Backlog" } });
  });
});

describe("moveColumn returns reason codes and nothing else, invalid_input included (FR-052, FR-053)", () => {
  it("refuses a non-admin, a vanished target, an illegal target and a placement that is neither literal", async () => {
    const proj = await insertSeededProject();
    const backlog = await columnNamed(proj.id, "Backlog");
    const done = await columnNamed(proj.id, "Done");
    const other = await insertSeededProject();
    const foreign = await columnNamed(other.id, "Todo");

    await signInAs("member");
    expect(
      expectReasonCodeOnly(
        await moveColumn({ columnId: backlog.id, targetColumnId: done.id, placement: "after" }),
        MOVE_CODES,
      ),
    ).toEqual({ ok: false, error: "forbidden" });

    await signInAs("admin");
    expect(
      expectReasonCodeOnly(
        await moveColumn({ columnId: backlog.id, targetColumnId: crypto.randomUUID(), placement: "after" }),
        MOVE_CODES,
      ),
    ).toEqual({ ok: false, error: "not_found" });
    expect(
      expectReasonCodeOnly(
        await moveColumn({ columnId: backlog.id, targetColumnId: foreign.id, placement: "after" }),
        MOVE_CODES,
      ),
    ).toEqual({ ok: false, error: "invalid_target" });
    const placement: string = "sideways";
    expect(
      expectReasonCodeOnly(
        await moveColumn({ columnId: backlog.id, targetColumnId: done.id, placement } as {
          columnId: string;
          targetColumnId: string;
          placement: "before" | "after";
        }),
        MOVE_CODES,
      ),
    ).toEqual({ ok: false, error: "invalid_input" });
  });

  it("surfaces a malformed target id as the missing row, never as a PostgreSQL 22P02", async () => {
    await signInAs("admin");
    const proj = await insertSeededProject();
    const backlog = await columnNamed(proj.id, "Backlog");

    expect(
      expectReasonCodeOnly(
        await moveColumn({ columnId: backlog.id, targetColumnId: "not-a-uuid", placement: "after" }),
        MOVE_CODES,
      ),
    ).toEqual({ ok: false, error: "not_found" });
  });
});

describe("deleteColumn returns reason codes and nothing else (FR-052, FR-053)", () => {
  it("refuses a non-admin and a column that is already gone with codes alone", async () => {
    const proj = await insertSeededProject();
    const todo = await columnNamed(proj.id, "Todo");

    await signInAs("member");
    expect(expectReasonCodeOnly(await deleteColumn({ columnId: todo.id }), DELETE_CODES)).toEqual({
      ok: false,
      error: "forbidden",
    });

    await signInAs("admin");
    await testDb.delete(boardColumn).where(eq(boardColumn.id, todo.id));
    await expect(deleteColumn({ columnId: todo.id })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("carries each of the four refusals as a code from the union and nothing else", async () => {
    const admin = await signInAs("admin");
    const proj = await insertSeededProject();
    const backlog = await columnNamed(proj.id, "Backlog");
    const done = await columnNamed(proj.id, "Done");
    const canceled = await columnNamed(proj.id, "Canceled");
    await insertIssue(proj.id, backlog.id, admin.id);

    const sole = await insertProject();
    const now = new Date();
    const [only] = await testDb
      .insert(boardColumn)
      .values({
        projectId: sole.id,
        name: "Only",
        kind: "open",
        sortOrder: "a0",
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    if (!only) {
      throw new Error("insertColumn produced no row");
    }

    for (const [columnId, refusal] of [
      [backlog.id, "holds_issues"],
      [canceled.id, "last_canceled_kind"],
      [done.id, "last_done_kind"],
      [only.id, "last_column"],
    ] as const) {
      const payload = expectReasonCodeOnly(await deleteColumn({ columnId }), DELETE_CODES);
      expect(payload).toEqual({ ok: false, error: "refused", refusal });
      expect(DELETE_REFUSALS).toContain(payload.refusal);
    }
  });
});

describe("a malformed identifier is the missing row, never a database exception (FR-053)", () => {
  it("refuses a malformed project key and malformed column ids as notFound()", async () => {
    await signInAs("admin");

    for (const call of [
      () => createColumn({ projectKey: "not-a-key", name: "Review" }),
      () => updateColumn({ columnId: "not-a-uuid", name: "Review" }),
      () => moveColumn({ columnId: "not-a-uuid", targetColumnId: crypto.randomUUID(), placement: "after" }),
      () => deleteColumn({ columnId: "not-a-uuid" }),
    ]) {
      const thrown = await call().then(
        () => null,
        (error: unknown) => error,
      );
      expect(thrown).toBeInstanceOf(Error);
      expect((thrown as Error).message).toBe("NEXT_NOT_FOUND");
      expect(thrown).not.toHaveProperty("code");
    }
    expect(notFoundMock).toHaveBeenCalledTimes(4);
  });
});