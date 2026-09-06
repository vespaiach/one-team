import { execFileSync } from "node:child_process";
import { asc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { boardColumn, issue, issueCounter, project, projectMember, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { issueSession, SESSION_COOKIE_NAME } from "@/features/auth/server/sessions";

const { cookiesMock, headersMock, refreshMock, revalidatePathMock, redirectMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  headersMock: vi.fn(),
  refreshMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  redirectMock: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("next/headers", () => ({ cookies: cookiesMock, headers: headersMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("next/cache", () => ({ refresh: refreshMock, revalidatePath: revalidatePathMock }));

const { createBoardCard } = await import("@/features/issues/actions");

beforeEach(async () => {
  await truncateTestDatabase();
  process.env.APP_URL = "https://app.example.com";
  cookiesMock.mockReset();
  headersMock.mockReset();
  headersMock.mockResolvedValue(new Headers({ origin: "https://app.example.com" }));
  refreshMock.mockReset();
  revalidatePathMock.mockReset();
});

async function seedBoard() {
  const now = new Date(Date.now() - 60_000);
  const [member] = await testDb
    .insert(user)
    .values({
      firstName: "Ada",
      lastName: "Lovelace",
      email: `ada-${crypto.randomUUID()}@example.com`,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!member) {
    throw new Error("insertUser produced no row");
  }

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
    .values({ projectId: board.id, userId: member.id, createdAt: now, updatedAt: now });
  await testDb.insert(issueCounter).values({ projectId: board.id, lastNumber: 2 });

  const columns: string[] = [];
  for (const seed of [
    { name: "Todo", sortOrder: "a0" },
    { name: "In Progress", sortOrder: "a1" },
  ]) {
    const [row] = await testDb
      .insert(boardColumn)
      .values({ ...seed, kind: "open", projectId: board.id, createdAt: now, updatedAt: now })
      .returning();
    if (!row) {
      throw new Error("insertColumn produced no row");
    }
    columns.push(row.id);
  }

  const [todo, inProgress] = columns;
  if (todo === undefined || inProgress === undefined) {
    throw new Error("seedBoard produced no columns");
  }

  for (const seed of [
    { number: 1, title: "Fix the header", columnId: todo, sortOrder: "a0" },
    { number: 2, title: "Audit the empty states", columnId: inProgress, sortOrder: "a1" },
  ]) {
    await testDb
      .insert(issue)
      .values({ ...seed, projectId: board.id, createdBy: member.id, createdAt: now, updatedAt: now });
  }

  const { token } = await issueSession({ userId: member.id, ipAddress: "203.0.113.4", userAgent: null });
  cookiesMock.mockResolvedValue({
    get: (name: string) => (name === SESSION_COOKIE_NAME ? { value: token } : undefined),
  });

  return { member, project: board, todo, inProgress };
}

async function census() {
  const rows = await testDb.select().from(issue).orderBy(asc(issue.number));
  return rows.map((row) => ({
    number: row.number,
    columnId: row.columnId,
    assigneeId: row.assigneeId,
    priority: row.priority,
    sortOrder: row.sortOrder,
    updatedAt: row.updatedAt.toISOString(),
  }));
}

async function sortOrders(projectId: string) {
  const rows = await testDb
    .select({ number: issue.number, sortOrder: issue.sortOrder })
    .from(issue)
    .where(eq(issue.projectId, projectId))
    .orderBy(asc(issue.number));
  return rows;
}

describe("the composer's create lands at the foot of the project's order (FR-026, FR-049, SC-013)", () => {
  it("places the new issue after every existing one and writes no existing row", async () => {
    const board = await seedBoard();
    const before = await census();

    const result = await createBoardCard({
      projectId: board.project.id,
      title: "Trim the seed data",
      columnId: board.inProgress,
    });

    expect(result).toMatchObject({ status: "ok" });

    const after = await census();
    expect(after).toHaveLength(before.length + 1);
    expect(after.slice(0, before.length)).toEqual(before);

    const orders = await sortOrders(board.project.id);
    const created = orders.at(-1);
    if (created === undefined) {
      throw new Error("no issue was created");
    }
    for (const row of orders.slice(0, -1)) {
      expect(created.sortOrder > row.sortOrder).toBe(true);
    }
  });

  it("creates two issues on two submissions in quick succession, neither touching the other's index", async () => {
    const board = await seedBoard();
    const before = await census();

    const first = await createBoardCard({
      projectId: board.project.id,
      title: "Trim the seed data",
      columnId: board.inProgress,
    });
    const afterFirst = await sortOrders(board.project.id);

    const second = await createBoardCard({
      projectId: board.project.id,
      title: "Retire the legacy tokens",
      columnId: board.inProgress,
    });

    expect(first).toMatchObject({ status: "ok" });
    expect(second).toMatchObject({ status: "ok" });

    const after = await census();
    expect(after).toHaveLength(before.length + 2);
    expect(after.slice(0, before.length)).toEqual(before);

    const orders = await sortOrders(board.project.id);
    expect(orders.slice(0, afterFirst.length)).toEqual(afterFirst);

    const last = orders.at(-1);
    const previous = orders.at(-2);
    if (last === undefined || previous === undefined) {
      throw new Error("both issues were not created");
    }
    expect(last.sortOrder > previous.sortOrder).toBe(true);
  });

  it("carries the lane's assignee and priority the composer chose, and nothing else", async () => {
    const board = await seedBoard();

    await createBoardCard({
      projectId: board.project.id,
      title: "Rework the sign-in copy",
      columnId: board.todo,
      assigneeId: board.member.id,
      priority: "high",
    });

    const created = (await census()).at(-1);
    expect(created).toMatchObject({
      columnId: board.todo,
      assigneeId: board.member.id,
      priority: "high",
    });
  });
});

describe("createIssue itself is untouched by this feature (FR-026)", () => {
  it("has no working-tree change against HEAD", () => {
    const diff = execFileSync(
      "git",
      ["diff", "--stat", "HEAD", "--", "src/features/issues/server/create-issue.ts"],
      { cwd: process.cwd(), encoding: "utf8" },
    );

    expect(diff).toBe("");
  });
});