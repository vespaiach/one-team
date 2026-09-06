import { asc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { activity, boardColumn, issue, project, projectMember, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import type { Actor } from "@/features/auth/server/actor";
import { type MoveIssueState, moveIssue } from "./move-issue";

const { notFoundMock } = vi.hoisted(() => ({
  notFoundMock: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({ notFound: notFoundMock }));

beforeEach(async () => {
  await truncateTestDatabase();
  notFoundMock.mockClear();
});

async function insertUser() {
  const now = new Date();
  const [row] = await testDb
    .insert(user)
    .values({
      firstName: "Ada",
      lastName: "Lovelace",
      email: `ada-${crypto.randomUUID()}@example.com`,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!row) {
    throw new Error("insertUser produced no row");
  }
  return row;
}

async function seedBoard(name = "Website Redesign") {
  const now = new Date(Date.now() - 60_000);
  const owner = await insertUser();
  const [board] = await testDb
    .insert(project)
    .values({
      key: `P${crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      name,
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

  const issues = new Map<number, typeof issue.$inferSelect>();
  for (const seed of [
    { number: 1, column: "Todo", sortOrder: "a0" },
    { number: 2, column: "Todo", sortOrder: "a1" },
    { number: 3, column: "In Progress", sortOrder: "a2" },
  ]) {
    const [row] = await testDb
      .insert(issue)
      .values({
        projectId: board.id,
        number: seed.number,
        title: `Issue ${seed.number}`,
        columnId: columnId(columns, seed.column),
        createdBy: owner.id,
        sortOrder: seed.sortOrder,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    if (!row) {
      throw new Error("insertIssue produced no row");
    }
    issues.set(seed.number, row);
  }

  return { owner, project: board, columns, issues };
}

function columnId(columns: Map<string, typeof boardColumn.$inferSelect>, name: string): string {
  const row = columns.get(name);
  if (!row) {
    throw new Error(`no seeded column named ${name}`);
  }
  return row.id;
}

function issueId(issues: Map<number, typeof issue.$inferSelect>, number: number): string {
  const row = issues.get(number);
  if (!row) {
    throw new Error(`no seeded issue numbered ${number}`);
  }
  return row.id;
}

function actorFor(userRow: { id: string; role: string }): Actor {
  return {
    id: userRow.id,
    role: userRow.role,
    firstName: "Ada",
    lastName: "Lovelace",
    avatarUrl: null,
    mustChangePassword: false,
  };
}

async function census() {
  const rows = await testDb.select().from(issue).orderBy(asc(issue.projectId), asc(issue.number));
  return rows.map((row) => ({
    id: row.id,
    columnId: row.columnId,
    assigneeId: row.assigneeId,
    priority: row.priority,
    sortOrder: row.sortOrder,
    updatedAt: row.updatedAt.toISOString(),
  }));
}

describe("moveIssue refuses a drop between two tied indexes (FR-024, FR-031, research A-3)", () => {
  async function seedTiedLane() {
    const seeded = await seedBoard();
    await testDb
      .update(issue)
      .set({ sortOrder: "a1" })
      .where(eq(issue.id, issueId(seeded.issues, 1)));
    await testDb
      .update(issue)
      .set({ sortOrder: "a1" })
      .where(eq(issue.id, issueId(seeded.issues, 2)));
    const lane = await testDb
      .select()
      .from(issue)
      .where(eq(issue.columnId, columnId(seeded.columns, "Todo")))
      .orderBy(asc(issue.sortOrder), asc(issue.id));
    const second = lane[1];
    if (!second) {
      throw new Error("the tied lane holds fewer than two cards");
    }
    return { ...seeded, tiedFollower: second.id };
  }

  it("returns no_index_available for a drop between two cards holding one index", async () => {
    const { owner, columns, issues, tiedFollower } = await seedTiedLane();
    const before = await census();

    const result = await moveIssue({
      actor: actorFor(owner),
      issueId: issueId(issues, 3),
      grouping: "column",
      laneId: columnId(columns, "Todo"),
      targetIssueId: tiedFollower,
      placement: "before",
    });

    expect(result).toEqual({ ok: false, error: "no_index_available" });
    expect(await census()).toEqual(before);
  });

  it("renumbers no index anywhere in the project when it refuses", async () => {
    const { owner, columns, issues, tiedFollower } = await seedTiedLane();
    const before = await census();

    await moveIssue({
      actor: actorFor(owner),
      issueId: issueId(issues, 3),
      grouping: "column",
      laneId: columnId(columns, "Todo"),
      targetIssueId: tiedFollower,
      placement: "before",
    });

    expect((await census()).map((row) => row.sortOrder)).toEqual(before.map((row) => row.sortOrder));
    expect(await testDb.select().from(activity)).toEqual([]);
  });
});

const SEQUENTIAL_DROPS = 100;

const TIE_PROBE_EVERY = 10;

function rotating<Item>(items: readonly Item[], step: number): Item {
  const item = items[step % items.length];
  if (item === undefined) {
    throw new Error("nothing to rotate through");
  }
  return item;
}

describe("a hundred sequential drops over a tied lane (FR-024, SC-005, quickstart.md walkthrough 3)", () => {
  async function seedTiedPairAndPool() {
    const seeded = await seedBoard();
    for (const number of [1, 2]) {
      await testDb
        .update(issue)
        .set({ sortOrder: "a1" })
        .where(eq(issue.id, issueId(seeded.issues, number)));
    }

    const tiedLane = await testDb
      .select({ id: issue.id })
      .from(issue)
      .where(eq(issue.columnId, columnId(seeded.columns, "Todo")))
      .orderBy(asc(issue.sortOrder), asc(issue.id));
    const [tiedFirstRow, tiedSecondRow] = tiedLane;
    if (!tiedFirstRow || !tiedSecondRow) {
      throw new Error("the tied lane holds fewer than two cards");
    }

    const now = new Date(Date.now() - 60_000);
    const pool = [issueId(seeded.issues, 3)];
    for (const seed of [
      { number: 4, column: "Todo", sortOrder: "b0" },
      { number: 5, column: "In Progress", sortOrder: "b1" },
      { number: 6, column: "Todo", sortOrder: "b2" },
      { number: 7, column: "In Progress", sortOrder: "b3" },
    ]) {
      const [row] = await testDb
        .insert(issue)
        .values({
          projectId: seeded.project.id,
          number: seed.number,
          title: `Issue ${seed.number}`,
          columnId: columnId(seeded.columns, seed.column),
          createdBy: seeded.owner.id,
          sortOrder: seed.sortOrder,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      if (!row) {
        throw new Error("insertIssue produced no row");
      }
      pool.push(row.id);
    }

    return { ...seeded, pool, tiedFirst: tiedFirstRow.id, tiedSecond: tiedSecondRow.id };
  }

  it("writes at most the moved card's own index, drop after drop, and repairs no tie", async () => {
    const { owner, columns, pool, tiedFirst, tiedSecond } = await seedTiedPairAndPool();
    const laneNames = ["Todo", "In Progress"];
    const outcomes: MoveIssueState[] = [];
    let indexesWritten = 0;

    for (let step = 0; step < SEQUENTIAL_DROPS; step += 1) {
      const probingTheTie = step % TIE_PROBE_EVERY === TIE_PROBE_EVERY - 1;
      const movedIssueId = rotating(pool, step);
      const laneId = columnId(columns, probingTheTie ? "Todo" : rotating(laneNames, step));
      const laneCards = await testDb
        .select({ id: issue.id })
        .from(issue)
        .where(eq(issue.columnId, laneId))
        .orderBy(asc(issue.sortOrder), asc(issue.id));
      const targets = laneCards.map((row) => row.id).filter((id) => id !== movedIssueId);
      const rotatingTarget = targets.length === 0 ? null : rotating(targets, step);
      const targetIssueId = probingTheTie ? tiedSecond : rotatingTarget;

      const before = await census();
      const result = await moveIssue({
        actor: actorFor(owner),
        issueId: movedIssueId,
        grouping: "column",
        laneId,
        targetIssueId,
        placement: probingTheTie || step % 2 === 0 ? "before" : "after",
      });
      const after = await census();
      outcomes.push(result);

      expect(after.filter((row) => row.id !== movedIssueId)).toEqual(
        before.filter((row) => row.id !== movedIssueId),
      );

      const movedBefore = before.find((row) => row.id === movedIssueId);
      const movedAfter = after.find((row) => row.id === movedIssueId);
      if (movedBefore?.sortOrder !== movedAfter?.sortOrder) {
        indexesWritten += 1;
      }
    }

    expect(outcomes).toHaveLength(SEQUENTIAL_DROPS);
    expect(
      outcomes.filter((outcome) => !outcome.ok && outcome.error === "no_index_available").length,
    ).toBeGreaterThanOrEqual(SEQUENTIAL_DROPS / TIE_PROBE_EVERY);
    expect(indexesWritten).toBeGreaterThan(0);

    const todo = await testDb
      .select({ id: issue.id, sortOrder: issue.sortOrder })
      .from(issue)
      .where(eq(issue.columnId, columnId(columns, "Todo")))
      .orderBy(asc(issue.sortOrder), asc(issue.id));
    expect(todo.filter((row) => row.id === tiedFirst || row.id === tiedSecond)).toEqual([
      { id: tiedFirst, sortOrder: "a1" },
      { id: tiedSecond, sortOrder: "a1" },
    ]);
  });
});