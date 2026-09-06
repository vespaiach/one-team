import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { client } from "@/db";
import { boardColumn, comment, issue, issueLabel, label, project, projectMember, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import type { Actor } from "@/features/auth/server/actor";
import { loadBoard } from "./board-queries";

beforeEach(async () => {
  await truncateTestDatabase();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const now = new Date();

async function insertUser(overrides: Partial<typeof user.$inferInsert> = {}) {
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

async function insertColumn(overrides: Partial<typeof boardColumn.$inferInsert> & { projectId: string }) {
  const [row] = await testDb
    .insert(boardColumn)
    .values({ name: "Backlog", kind: "open", sortOrder: "a0", createdAt: now, updatedAt: now, ...overrides })
    .returning();
  if (!row) {
    throw new Error("insertColumn produced no row");
  }
  return row;
}

let nextIssueNumber = 0;

async function insertIssue(
  overrides: Partial<typeof issue.$inferInsert> & { projectId: string; columnId: string; createdBy: string },
) {
  nextIssueNumber += 1;
  const [row] = await testDb
    .insert(issue)
    .values({
      number: nextIssueNumber,
      title: "Ship the board",
      sortOrder: "a0",
      createdAt: now,
      updatedAt: now,
      ...overrides,
    })
    .returning();
  if (!row) {
    throw new Error("insertIssue produced no row");
  }
  return row;
}

async function insertLabel(name: string) {
  const [row] = await testDb.insert(label).values({ name, createdAt: now, updatedAt: now }).returning();
  if (!row) {
    throw new Error("insertLabel produced no row");
  }
  return row;
}

async function addMember(projectId: string, userId: string) {
  await testDb.insert(projectMember).values({ projectId, userId, createdAt: now, updatedAt: now });
}

async function addComment(issueId: string, authorId: string) {
  await testDb
    .insert(comment)
    .values({ issueId, authorId, body: "Looks good", createdAt: now, updatedAt: now });
}

function actorFor(row: typeof user.$inferSelect): Actor {
  return {
    id: row.id,
    role: row.role,
    firstName: row.firstName,
    lastName: row.lastName,
    avatarUrl: row.avatarUrl,
    mustChangePassword: row.mustChangePassword,
  };
}

describe("loadBoard (FR-002, FR-022, FR-023)", () => {
  it("returns null for a key no project holds", async () => {
    const actor = actorFor(await insertUser());

    expect(await loadBoard("NOSUCH", actor)).toBeNull();
  });

  it("returns the project and its columns in board order", async () => {
    const creator = await insertUser();
    const proj = await insertProject({ name: "Apollo", status: "archived" });
    await insertColumn({ projectId: proj.id, name: "Done", kind: "done", sortOrder: "a3" });
    await insertColumn({ projectId: proj.id, name: "Backlog", sortOrder: "a1" });
    await insertColumn({ projectId: proj.id, name: "Todo", sortOrder: "a2" });

    const board = await loadBoard(proj.key, actorFor(creator));

    expect(board?.project).toEqual({ id: proj.id, key: proj.key, name: "Apollo", status: "archived" });
    expect(board?.columns.map((column) => column.name)).toEqual(["Backlog", "Todo", "Done"]);
    expect(Object.keys(board?.columns[0] ?? {}).sort()).toEqual(["id", "name"]);
  });

  it("returns every card in the project in (sort_order, id) order with a zero-based rank", async () => {
    const creator = await insertUser();
    const proj = await insertProject({ key: "APOLLO" });
    const backlog = await insertColumn({ projectId: proj.id, name: "Backlog", sortOrder: "a1" });
    const todo = await insertColumn({ projectId: proj.id, name: "Todo", sortOrder: "a2" });
    const tied = [
      { id: "00000000-0000-4000-8000-00000000000b", sortOrder: "a1" },
      { id: "00000000-0000-4000-8000-00000000000a", sortOrder: "a1" },
      { id: "00000000-0000-4000-8000-00000000000c", sortOrder: "a0" },
    ];
    for (const seeded of tied) {
      await insertIssue({
        id: seeded.id,
        sortOrder: seeded.sortOrder,
        projectId: proj.id,
        columnId: seeded.sortOrder === "a0" ? todo.id : backlog.id,
        createdBy: creator.id,
      });
    }

    const board = await loadBoard(proj.key, actorFor(creator));

    expect(board?.cards.map((card) => card.id)).toEqual([
      "00000000-0000-4000-8000-00000000000c",
      "00000000-0000-4000-8000-00000000000a",
      "00000000-0000-4000-8000-00000000000b",
    ]);
    expect(board?.cards.map((card) => card.order)).toEqual([0, 1, 2]);
    expect(board?.cards.map((card) => card.columnId)).toEqual([todo.id, backlog.id, backlog.id]);
  });

  it("renders a card's key through the project key and issue number, and hides sort_order and project_id", async () => {
    const creator = await insertUser();
    const proj = await insertProject({ key: "APOLLO" });
    const backlog = await insertColumn({ projectId: proj.id });
    const row = await insertIssue({
      projectId: proj.id,
      columnId: backlog.id,
      createdBy: creator.id,
      number: 42,
      title: "Ship it",
      priority: "high",
      dueDate: "2026-01-31",
    });

    const board = await loadBoard(proj.key, actorFor(creator));
    const card = board?.cards[0];

    expect(card?.key).toBe("APOLLO-42");
    expect(card?.title).toBe("Ship it");
    expect(card?.priority).toBe("high");
    expect(card?.dueDate).toBe("2026-01-31");
    expect(card?.id).toBe(row.id);
    expect(card).not.toHaveProperty("sortOrder");
    expect(card).not.toHaveProperty("sort_order");
    expect(card).not.toHaveProperty("projectId");
    expect(card).not.toHaveProperty("project_id");
  });

  it("carries labels by name only, an assignee public shape and a comment count", async () => {
    const creator = await insertUser({ firstName: "Grace", lastName: "Hopper" });
    const proj = await insertProject();
    await addMember(proj.id, creator.id);
    const backlog = await insertColumn({ projectId: proj.id });
    const bug = await insertLabel("bug");
    const chore = await insertLabel("chore");
    const withEverything = await insertIssue({
      projectId: proj.id,
      columnId: backlog.id,
      createdBy: creator.id,
      assigneeId: creator.id,
      sortOrder: "a0",
    });
    await insertIssue({
      projectId: proj.id,
      columnId: backlog.id,
      createdBy: creator.id,
      sortOrder: "a1",
    });
    await testDb.insert(issueLabel).values([
      { issueId: withEverything.id, labelId: chore.id },
      { issueId: withEverything.id, labelId: bug.id },
    ]);
    await addComment(withEverything.id, creator.id);
    await addComment(withEverything.id, creator.id);

    const board = await loadBoard(proj.key, actorFor(creator));
    const [first, second] = board?.cards ?? [];

    expect(first?.labels.map((entry) => entry.name).sort()).toEqual(["bug", "chore"]);
    expect(Object.keys(first?.labels[0] ?? {}).sort()).toEqual(["id", "name"]);
    expect(first?.assignee).toEqual({
      id: creator.id,
      firstName: "Grace",
      lastName: "Hopper",
      avatarUrl: null,
    });
    expect(first?.assigneeId).toBe(creator.id);
    expect(first?.commentCount).toBe(2);
    expect(second?.labels).toEqual([]);
    expect(second?.assignee).toBeNull();
    expect(second?.assigneeId).toBeNull();
    expect(second?.commentCount).toBe(0);
  });

  it("returns the assignee pool ordered by last then first name", async () => {
    const admin = await insertUser({ firstName: "Zoe", lastName: "Adams", role: "admin" });
    const member = await insertUser({ firstName: "Alan", lastName: "Turing" });
    const stranger = await insertUser({ firstName: "Nobody", lastName: "Here" });
    const proj = await insertProject();
    await addMember(proj.id, member.id);

    const board = await loadBoard(proj.key, actorFor(admin));

    expect(board?.assigneePool.map((person) => person.id)).toEqual([admin.id, member.id]);
    expect(board?.assigneePool).not.toContainEqual(expect.objectContaining({ id: stranger.id }));
    expect(Object.keys(board?.assigneePool[0] ?? {}).sort()).toEqual([
      "avatarUrl",
      "firstName",
      "id",
      "lastName",
    ]);
  });

  it("lists people still assigned here but outside the pool exactly once", async () => {
    const creator = await insertUser({ firstName: "Ada", lastName: "Lovelace", role: "admin" });
    const gone = await insertUser({ firstName: "Rear", lastName: "Baker", deactivatedAt: now });
    const removed = await insertUser({ firstName: "Ex", lastName: "Member" });
    const proj = await insertProject();
    const backlog = await insertColumn({ projectId: proj.id });
    for (const assignee of [gone, gone, removed]) {
      await insertIssue({
        projectId: proj.id,
        columnId: backlog.id,
        createdBy: creator.id,
        assigneeId: assignee.id,
      });
    }

    const board = await loadBoard(proj.key, actorFor(creator));

    expect(board?.assignedOutsidePool.map((person) => person.id)).toEqual([gone.id, removed.id]);
    expect(board?.assigneePool.map((person) => person.id)).toEqual([creator.id]);
  });

  it("grants write to a member, to an admin holding no membership row, and refuses a non-member by name", async () => {
    const member = await insertUser();
    const admin = await insertUser({ role: "admin" });
    const outsider = await insertUser();
    const proj = await insertProject({ name: "Apollo" });
    await addMember(proj.id, member.id);

    const asMember = await loadBoard(proj.key, actorFor(member));
    const asAdmin = await loadBoard(proj.key, actorFor(admin));
    const asOutsider = await loadBoard(proj.key, actorFor(outsider));

    expect(asMember).toMatchObject({ canWrite: true, writeReason: "" });
    expect(asAdmin).toMatchObject({ canWrite: true, writeReason: "" });
    expect(asOutsider?.canWrite).toBe(false);
    expect(asOutsider?.writeReason).toContain("Apollo");
    expect(asOutsider?.cards).toHaveLength(0);
  });

  it("issues the same number of queries however many cards and lanes the board holds (D-5)", async () => {
    const member = await insertUser();
    const small = await insertProject();
    const large = await insertProject();
    await addMember(small.id, member.id);
    await addMember(large.id, member.id);
    const smallColumn = await insertColumn({ projectId: small.id });
    for (const index of [0, 1]) {
      await insertIssue({
        projectId: small.id,
        columnId: smallColumn.id,
        createdBy: member.id,
        sortOrder: `a${index}`,
      });
    }
    for (const lane of [1, 2, 3, 4, 5]) {
      const column = await insertColumn({ projectId: large.id, name: `Lane ${lane}`, sortOrder: `a${lane}` });
      for (const index of [0, 1, 2, 3]) {
        await insertIssue({
          projectId: large.id,
          columnId: column.id,
          createdBy: member.id,
          sortOrder: `a${lane}${index}`,
        });
      }
    }

    const spy = vi.spyOn(client, "unsafe");
    await loadBoard(small.key, actorFor(member));
    const smallCount = spy.mock.calls.length;
    spy.mockClear();
    await loadBoard(large.key, actorFor(member));
    const largeCount = spy.mock.calls.length;

    expect(largeCount).toBe(smallCount);
    expect(smallCount).toBe(8);
  });
});