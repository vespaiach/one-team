import { asc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { activity, boardColumn, issue, project, projectMember, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { issueSession, SESSION_COOKIE_NAME } from "@/features/auth/server/sessions";

const { cookiesMock, headersMock, refreshMock, revalidatePathMock, redirectMock, notFoundMock } = vi.hoisted(
  () => ({
    cookiesMock: vi.fn(),
    headersMock: vi.fn(),
    refreshMock: vi.fn(),
    revalidatePathMock: vi.fn(),
    redirectMock: vi.fn((url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`);
    }),
    notFoundMock: vi.fn(() => {
      throw new Error("NEXT_NOT_FOUND");
    }),
  }),
);

vi.mock("next/headers", () => ({ cookies: cookiesMock, headers: headersMock }));

vi.mock("next/navigation", () => ({ redirect: redirectMock, notFound: notFoundMock }));

vi.mock("next/cache", () => ({ refresh: refreshMock, revalidatePath: revalidatePathMock }));

const { moveIssue } = await import("./actions");

beforeEach(async () => {
  await truncateTestDatabase();
  process.env.APP_URL = "https://app.example.com";
  cookiesMock.mockReset();
  headersMock.mockReset();
  headersMock.mockResolvedValue(new Headers({ origin: "https://app.example.com" }));
  refreshMock.mockReset();
  revalidatePathMock.mockReset();
  notFoundMock.mockClear();
});

async function insertUser(role: "member" | "admin" = "member") {
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

async function seedBoard() {
  const now = new Date(Date.now() - 60_000);
  const owner = await insertUser();
  const [board] = await testDb
    .insert(project)
    .values({
      key: `P${crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      name: "Website Redesign",
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!board) {
    throw new Error("insertProject produced no row");
  }
  await testDb
    .insert(projectMember)
    .values({ projectId: board.id, userId: owner.id, createdAt: now, updatedAt: now });

  const columns = new Map<string, typeof boardColumn.$inferSelect>();
  for (const seed of [
    { name: "Todo", kind: "open", sortOrder: "a0" },
    { name: "In Progress", kind: "open", sortOrder: "a1" },
    { name: "Done", kind: "done", sortOrder: "a2" },
    { name: "Canceled", kind: "canceled", sortOrder: "a3" },
  ]) {
    const [row] = await testDb
      .insert(boardColumn)
      .values({ ...seed, projectId: board.id, createdAt: now, updatedAt: now })
      .returning();
    if (!row) {
      throw new Error("insertColumn produced no row");
    }
    columns.set(seed.name, row);
  }

  const [card] = await testDb
    .insert(issue)
    .values({
      projectId: board.id,
      number: 1,
      title: "Fix the header",
      columnId: columnId(columns, "Todo"),
      createdBy: owner.id,
      sortOrder: "a0",
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!card) {
    throw new Error("insertIssue produced no row");
  }

  return { owner, project: board, columns, card };
}

function columnId(columns: Map<string, typeof boardColumn.$inferSelect>, name: string): string {
  const row = columns.get(name);
  if (!row) {
    throw new Error(`no seeded column named ${name}`);
  }
  return row.id;
}

async function census() {
  const rows = await testDb.select().from(issue).orderBy(asc(issue.number));
  return rows.map((row) => ({
    id: row.id,
    columnId: row.columnId,
    sortOrder: row.sortOrder,
    updatedAt: row.updatedAt.toISOString(),
  }));
}

describe("the moveIssue Server Action's write boundary (SC-011, FR-065, research B-10)", () => {
  it("refuses a cross-origin request before the actor is resolved", async () => {
    const { columns, card } = await seedBoard();
    headersMock.mockResolvedValue(new Headers({ origin: "https://evil.example.com" }));
    const before = await census();

    await expect(
      moveIssue({
        issueId: card.id,
        grouping: "column",
        laneId: columnId(columns, "In Progress"),
        targetIssueId: null,
        placement: "after",
      }),
    ).rejects.toThrow("forbidden_origin");

    expect(cookiesMock).not.toHaveBeenCalled();
    expect(await census()).toEqual(before);
    expect(await testDb.select().from(activity)).toEqual([]);
  });

  it("sends a signed-out caller to sign in, writing nothing", async () => {
    const { columns, card } = await seedBoard();
    cookiesMock.mockResolvedValue({ get: () => undefined });
    const before = await census();

    await expect(
      moveIssue({
        issueId: card.id,
        grouping: "column",
        laneId: columnId(columns, "In Progress"),
        targetIssueId: null,
        placement: "after",
      }),
    ).rejects.toThrow("NEXT_REDIRECT:/signin");

    expect(await census()).toEqual(before);
  });

  it("refuses a signed-in non-member with forbidden, writing nothing", async () => {
    const { columns, card } = await seedBoard();
    const stranger = await insertUser();
    await signInAs(stranger.id);
    const before = await census();

    const result = await moveIssue({
      issueId: card.id,
      grouping: "column",
      laneId: columnId(columns, "In Progress"),
      targetIssueId: null,
      placement: "after",
    });

    expect(result).toEqual({
      ok: false,
      error: "forbidden",
      reason: expect.stringContaining("Website Redesign") as string,
    });
    expect(await census()).toEqual(before);
  });

  it("moves the card for a member and refreshes neither the route nor the router", async () => {
    const { owner, columns, card } = await seedBoard();
    await signInAs(owner.id);

    const result = await moveIssue({
      issueId: card.id,
      grouping: "column",
      laneId: columnId(columns, "In Progress"),
      targetIssueId: null,
      placement: "after",
    });

    expect(result).toEqual({ ok: true });
    const [moved] = await testDb.select().from(issue).where(eq(issue.id, card.id));
    expect(moved?.columnId).toBe(columnId(columns, "In Progress"));
    expect(refreshMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});

describe("the moveIssue write boundary a board can never soften (FR-039, FR-040, FR-065, SC-011)", () => {
  it("refuses a signed-in non-member on every attempt, whatever the board rendered", async () => {
    const { owner, columns, card } = await seedBoard();
    const stranger = await insertUser();
    await signInAs(stranger.id);
    const before = await census();

    const attempts: Omit<Parameters<typeof moveIssue>[0], "issueId">[] = [
      {
        grouping: "column",
        laneId: columnId(columns, "In Progress"),
        targetIssueId: null,
        placement: "after",
      },
      { grouping: "column", laneId: columnId(columns, "Done"), targetIssueId: null, placement: "before" },
      { grouping: "column", laneId: columnId(columns, "Canceled"), targetIssueId: null, placement: "after" },
      { grouping: "column", laneId: columnId(columns, "Todo"), targetIssueId: card.id, placement: "before" },
      { grouping: "assignee", laneId: null, targetIssueId: null, placement: "after" },
      { grouping: "assignee", laneId: owner.id, targetIssueId: null, placement: "after" },
      { grouping: "priority", laneId: "urgent", targetIssueId: null, placement: "after" },
      { grouping: "sideways", laneId: "not-a-lane", targetIssueId: "not-a-card", placement: "upwards" },
    ];

    const results = [];
    for (const attempt of attempts) {
      results.push(await moveIssue({ issueId: card.id, ...attempt }));
    }

    expect(results).toEqual(
      attempts.map(() => ({
        ok: false,
        error: "forbidden",
        reason: expect.stringContaining("Website Redesign") as string,
      })),
    );
    expect(await census()).toEqual(before);
    expect(await testDb.select().from(activity)).toEqual([]);
  });

  it("lets an admin holding no project_member row move the card (FR-068)", async () => {
    const { columns, card } = await seedBoard();
    const admin = await insertUser("admin");
    await signInAs(admin.id);

    const result = await moveIssue({
      issueId: card.id,
      grouping: "column",
      laneId: columnId(columns, "In Progress"),
      targetIssueId: null,
      placement: "after",
    });

    expect(result).toEqual({ ok: true });
    expect(await testDb.select().from(projectMember).where(eq(projectMember.userId, admin.id))).toEqual([]);
    const [moved] = await testDb.select().from(issue).where(eq(issue.id, card.id));
    expect(moved?.columnId).toBe(columnId(columns, "In Progress"));
  });

  it("accepts every call in an archived project, because project status is never a condition", async () => {
    const { owner, project: board, columns, card } = await seedBoard();
    await testDb.update(project).set({ status: "archived" }).where(eq(project.id, board.id));
    await signInAs(owner.id);

    const results = [
      await moveIssue({
        issueId: card.id,
        grouping: "column",
        laneId: columnId(columns, "In Progress"),
        targetIssueId: null,
        placement: "after",
      }),
      await moveIssue({
        issueId: card.id,
        grouping: "priority",
        laneId: "urgent",
        targetIssueId: null,
        placement: "after",
      }),
    ];

    expect(results).toEqual([{ ok: true }, { ok: true }]);
    const [moved] = await testDb.select().from(issue).where(eq(issue.id, card.id));
    expect(moved?.columnId).toBe(columnId(columns, "In Progress"));
    expect(moved?.priority).toBe("urgent");
  });

  it("takes a card into a terminal column and straight back out, with no confirmation and no guardrail", async () => {
    const { owner, columns, card } = await seedBoard();
    await signInAs(owner.id);

    const route = ["Done", "Todo", "Canceled", "Todo"];
    const results = [];
    for (const name of route) {
      results.push(
        await moveIssue({
          issueId: card.id,
          grouping: "column",
          laneId: columnId(columns, name),
          targetIssueId: null,
          placement: "after",
        }),
      );
    }

    expect(results).toEqual(route.map(() => ({ ok: true })));
    const [moved] = await testDb.select().from(issue).where(eq(issue.id, card.id));
    expect(moved?.columnId).toBe(columnId(columns, "Todo"));
  });

  it("reads a column's kind nowhere: a terminal target writes exactly what an open one writes", async () => {
    const { owner, columns, card } = await seedBoard();
    await signInAs(owner.id);

    await moveIssue({
      issueId: card.id,
      grouping: "column",
      laneId: columnId(columns, "In Progress"),
      targetIssueId: null,
      placement: "after",
    });
    await moveIssue({
      issueId: card.id,
      grouping: "column",
      laneId: columnId(columns, "Done"),
      targetIssueId: null,
      placement: "after",
    });

    const rows = await testDb.select().from(activity).orderBy(asc(activity.createdAt));
    expect(rows.map((row) => [row.type, row.field, row.fromValue, row.toValue])).toEqual([
      ["field_changed", "column", "Todo", "In Progress"],
      ["field_changed", "column", "In Progress", "Done"],
    ]);
    const kinds = await testDb
      .select({ name: boardColumn.name, kind: boardColumn.kind })
      .from(boardColumn)
      .orderBy(asc(boardColumn.sortOrder));
    expect(kinds).toEqual([
      { name: "Todo", kind: "open" },
      { name: "In Progress", kind: "open" },
      { name: "Done", kind: "done" },
      { name: "Canceled", kind: "canceled" },
    ]);
  });
});