import { eq } from "drizzle-orm";
import postgres from "postgres";
import { beforeEach, describe, expect, it } from "vitest";
import { boardColumn, issue, project, projectMember, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import type { Actor } from "@/features/auth/server/actor";
import { moveIssue } from "./move-issue";

const LANE_KEYS = ["a0", "a1", "a2", "a3", "a4", "a5"];

function requireTestDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error("TEST_DATABASE_URL is not set");
  }
  return url;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function tracked<T>(pending: Promise<T>): { hasSettled: () => boolean; result: Promise<T> } {
  let settled = false;
  const result = pending.then(
    (value) => {
      settled = true;
      return value;
    },
    (error: unknown) => {
      settled = true;
      throw error;
    },
  );
  return { hasSettled: () => settled, result };
}

async function insertUser(firstName: string, lastName: string) {
  const now = new Date();
  const [row] = await testDb
    .insert(user)
    .values({
      firstName,
      lastName,
      email: `${lastName.toLowerCase()}-${crypto.randomUUID()}@example.com`,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!row) {
    throw new Error("insertUser produced no row");
  }
  return row;
}

function actorFor(person: typeof user.$inferSelect): Actor {
  return {
    id: person.id,
    role: person.role,
    firstName: person.firstName,
    lastName: person.lastName,
    avatarUrl: null,
    mustChangePassword: false,
  };
}

async function seedBoard(cardsInTodo: number) {
  const now = new Date(Date.now() - 60_000);
  const member = await insertUser("Grace", "Hopper");

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

  const columns = new Map<string, string>();
  for (const [position, name] of ["Todo", "Doing"].entries()) {
    const [row] = await testDb
      .insert(boardColumn)
      .values({
        projectId: board.id,
        name,
        kind: "open",
        sortOrder: LANE_KEYS[position] ?? "a0",
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    if (!row) {
      throw new Error("insertColumn produced no row");
    }
    columns.set(name, row.id);
  }

  const todoId = columns.get("Todo");
  const doingId = columns.get("Doing");
  if (!todoId || !doingId) {
    throw new Error("seedBoard produced no columns");
  }

  const todo: string[] = [];
  for (let position = 0; position < cardsInTodo; position += 1) {
    const [row] = await testDb
      .insert(issue)
      .values({
        projectId: board.id,
        number: position + 1,
        title: `Todo card ${position + 1}`,
        columnId: todoId,
        createdBy: member.id,
        sortOrder: LANE_KEYS[position] ?? "a0",
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    if (!row) {
      throw new Error("insertIssue produced no row");
    }
    todo.push(row.id);
  }

  const [resident] = await testDb
    .insert(issue)
    .values({
      projectId: board.id,
      number: cardsInTodo + 1,
      title: "Doing resident",
      columnId: doingId,
      createdBy: member.id,
      sortOrder: "a0",
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!resident) {
    throw new Error("insertIssue produced no row");
  }

  return { member, todoId, doingId, todo, residentId: resident.id };
}

function dropInto(
  actor: Actor,
  issueId: string,
  laneId: string,
  targetIssueId: string | null,
  placement: "before" | "after",
) {
  return moveIssue({ actor, issueId, grouping: "column", laneId, targetIssueId, placement });
}

function requireCard(cards: string[], position: number): string {
  const id = cards[position];
  if (!id) {
    throw new Error(`no seeded card at position ${position}`);
  }
  return id;
}

beforeEach(async () => {
  await truncateTestDatabase();
});

describe("moveIssue under concurrent drops (FR-057, SC-007, research B-5)", () => {
  it("takes the moved row FOR UPDATE, so a drop waits on a lock already held over that one card", async () => {
    const { member, doingId, todo, residentId } = await seedBoard(2);
    const moved = requireCard(todo, 0);

    const holder = postgres(requireTestDatabaseUrl(), { max: 1 });
    try {
      await holder`BEGIN`;
      await holder`SELECT id FROM issue WHERE id = ${moved} FOR UPDATE`;

      const drop = tracked(dropInto(actorFor(member), moved, doingId, residentId, "after"));
      await delay(300);
      expect(drop.hasSettled()).toBe(false);

      await holder`COMMIT`;
      expect(await drop.result).toEqual({ ok: true });
    } finally {
      await holder.end();
    }
  });

  it("does not lock the lane, so a drop into a lane completes while another card in that lane is locked", async () => {
    const { member, doingId, todo, residentId } = await seedBoard(2);
    const moved = requireCard(todo, 0);

    const holder = postgres(requireTestDatabaseUrl(), { max: 1 });
    try {
      await holder`BEGIN`;
      await holder`SELECT id FROM issue WHERE id = ${residentId} FOR UPDATE`;

      const drop = tracked(dropInto(actorFor(member), moved, doingId, residentId, "after"));
      await delay(300);
      expect(drop.hasSettled()).toBe(true);
      expect(await drop.result).toEqual({ ok: true });

      await holder`COMMIT`;
    } finally {
      await holder.end();
    }
  });

  it("does not serialize drops of different cards into one lane, and refuses none of them", async () => {
    const { member, doingId, todo, residentId } = await seedBoard(4);
    const actor = actorFor(member);

    const results = await Promise.all(
      todo.map((cardId) => dropInto(actor, cardId, doingId, residentId, "after")),
    );

    expect(results).toEqual(todo.map(() => ({ ok: true })));

    const landed = await testDb.select().from(issue).where(eq(issue.columnId, doingId));
    expect(landed).toHaveLength(todo.length + 1);
  });

  it("lets the later of two conflicting drops of one card win, refusing neither", async () => {
    const { member, doingId, todoId, todo, residentId } = await seedBoard(2);
    const actor = actorFor(member);
    const moved = requireCard(todo, 0);
    const neighbour = requireCard(todo, 1);

    const holder = postgres(requireTestDatabaseUrl(), { max: 1 });
    try {
      await holder`BEGIN`;
      await holder`SELECT id FROM issue WHERE id = ${moved} FOR UPDATE`;

      const earlier = tracked(dropInto(actor, moved, doingId, residentId, "after"));
      await delay(200);
      await holder`COMMIT`;
      expect(await earlier.result).toEqual({ ok: true });
    } finally {
      await holder.end();
    }

    const later = await dropInto(actor, moved, todoId, neighbour, "before");
    expect(later).toEqual({ ok: true });

    const [row] = await testDb.select().from(issue).where(eq(issue.id, moved));
    expect(row?.columnId).toBe(todoId);
  });

  it("returns ok to both racing drops of one card and leaves one of their two lanes stored", async () => {
    const { member, doingId, todoId, todo, residentId } = await seedBoard(2);
    const actor = actorFor(member);
    const moved = requireCard(todo, 0);
    const neighbour = requireCard(todo, 1);

    const [first, second] = await Promise.all([
      dropInto(actor, moved, doingId, residentId, "after"),
      dropInto(actor, moved, todoId, neighbour, "after"),
    ]);

    expect(first).toEqual({ ok: true });
    expect(second).toEqual({ ok: true });

    const [row] = await testDb.select().from(issue).where(eq(issue.id, moved));
    expect([todoId, doingId]).toContain(row?.columnId);
  });
});