import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { boardColumn, project, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import type { Actor } from "@/features/auth/server/actor";
import { type DeleteColumnState, deleteColumn } from "./delete-column";
import { type MoveColumnState, moveColumn } from "./move-column";

function requireTestDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error("TEST_DATABASE_URL is not set");
  }
  return url;
}

const secondConnection = postgres(requireTestDatabaseUrl(), { max: 2 });
const secondDb = drizzle(secondConnection, { schema });

const DEADLOCK_DETECTED = "40P01";
const STAGGER_MILLISECONDS = 50;

const SETTLED_MOVE_STATES: MoveColumnState[] = [{ ok: true }, { ok: false, error: "not_found" }];

const SETTLED_DELETE_STATES: DeleteColumnState[] = [
  { ok: true },
  { ok: false, error: "not_found" },
  { ok: false, error: "refused", refusal: "holds_issues" },
  { ok: false, error: "refused", refusal: "last_column" },
  { ok: false, error: "refused", refusal: "last_canceled_kind" },
  { ok: false, error: "refused", refusal: "last_done_kind" },
];

afterAll(async () => {
  await secondConnection.end();
});

beforeEach(async () => {
  await truncateTestDatabase();
});

function actorFor(row: { id: string; role: string; firstName: string; lastName: string }): Actor {
  return {
    id: row.id,
    role: row.role,
    firstName: row.firstName,
    lastName: row.lastName,
    avatarUrl: null,
    mustChangePassword: false,
  };
}

async function insertAdmin() {
  const now = new Date();
  const [row] = await testDb
    .insert(user)
    .values({
      firstName: "Ada",
      lastName: "Lovelace",
      email: `ada-${crypto.randomUUID()}@example.com`,
      role: "admin",
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!row) {
    throw new Error("insertAdmin produced no row");
  }
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

async function insertColumns(projectId: string, values: { name: string; kind: string; sortOrder: string }[]) {
  const now = new Date();
  return await testDb
    .insert(boardColumn)
    .values(values.map((value) => ({ projectId, ...value, createdAt: now, updatedAt: now })))
    .returning();
}

function columnNamed(rows: (typeof boardColumn.$inferSelect)[], name: string) {
  const row = rows.find((column) => column.name === name);
  if (!row) {
    throw new Error(`no column named ${name}`);
  }
  return row;
}

function settle(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function startAfter<T>(milliseconds: number, work: () => Promise<T>): Promise<T> {
  return settle(milliseconds).then(work);
}

type Settlement<T> = { resolved: T } | { rejectedWithCode: string | null };

async function settlementOf<T>(work: Promise<T>): Promise<Settlement<T>> {
  try {
    return { resolved: await work };
  } catch (error) {
    return { rejectedWithCode: postgresErrorCode(error) };
  }
}

function postgresErrorCode(error: unknown): string | null {
  if (typeof error === "object" && error !== null && "code" in error && typeof error.code === "string") {
    return error.code;
  }
  return null;
}

function rejectionCodes(settlements: Settlement<unknown>[]): (string | null)[] {
  return settlements.flatMap((settlement) =>
    "rejectedWithCode" in settlement ? [settlement.rejectedWithCode] : [],
  );
}

function requireResolved<T>(settlement: Settlement<T>): T {
  if ("rejectedWithCode" in settlement) {
    throw new Error(`transaction rejected with SQLSTATE ${settlement.rejectedWithCode}`);
  }
  return settlement.resolved;
}

async function raceMoveAgainstDelete(options: {
  actor: Actor;
  projectId: string;
  movedId: string;
  targetColumnId: string;
  placement: "before" | "after";
  deletedColumnId: string;
  firstToStart: "move" | "delete";
}): Promise<{ movement: MoveColumnState; deletion: DeleteColumnState }> {
  let announceHeld = () => {};
  const held = new Promise<void>((resolve) => {
    announceHeld = resolve;
  });
  let releaseHolder = () => {};
  const released = new Promise<void>((resolve) => {
    releaseHolder = resolve;
  });

  const holder = secondDb.transaction(async (tx) => {
    await tx.select().from(boardColumn).where(eq(boardColumn.projectId, options.projectId)).for("update");
    announceHeld();
    await released;
  });

  await held;

  const moving = startAfter(options.firstToStart === "move" ? 0 : STAGGER_MILLISECONDS, () =>
    moveColumn({
      actor: options.actor,
      columnId: options.movedId,
      targetColumnId: options.targetColumnId,
      placement: options.placement,
    }),
  );
  const deleting = startAfter(options.firstToStart === "delete" ? 0 : STAGGER_MILLISECONDS, () =>
    deleteColumn({
      actor: options.actor,
      projectId: options.projectId,
      columnId: options.deletedColumnId,
    }),
  );

  const settling = Promise.all([settlementOf(moving), settlementOf(deleting)]);
  await settle(STAGGER_MILLISECONDS * 3);
  releaseHolder();
  await holder;

  const settlements = await settling;
  const [movement, deletion] = settlements;
  expect(rejectionCodes(settlements)).not.toContain(DEADLOCK_DETECTED);

  return { movement: requireResolved(movement), deletion: requireResolved(deletion) };
}

async function seedBoard() {
  const admin = await insertAdmin();
  const proj = await insertProject();
  const columns = await insertColumns(proj.id, [
    { name: "Backlog", kind: "open", sortOrder: "a0" },
    { name: "Todo", kind: "open", sortOrder: "a1" },
    { name: "Doing", kind: "open", sortOrder: "a2" },
    { name: "Done", kind: "done", sortOrder: "a3" },
    { name: "Canceled", kind: "canceled", sortOrder: "a4" },
  ]);
  return { actor: actorFor(admin), projectId: proj.id, columns };
}

function expectOneCommitAndOneSettled(outcome: { movement: MoveColumnState; deletion: DeleteColumnState }) {
  expect([outcome.movement.ok, outcome.deletion.ok]).toContain(true);
  expect(SETTLED_MOVE_STATES).toContainEqual(outcome.movement);
  expect(SETTLED_DELETE_STATES).toContainEqual(outcome.deletion);
}

describe("moveColumn racing deleteColumn on one column set (FR-050)", () => {
  it("settles both when the move splices across the column the delete removes, the move queued first", async () => {
    const board = await seedBoard();

    const outcome = await raceMoveAgainstDelete({
      actor: board.actor,
      projectId: board.projectId,
      movedId: columnNamed(board.columns, "Backlog").id,
      targetColumnId: columnNamed(board.columns, "Done").id,
      placement: "after",
      deletedColumnId: columnNamed(board.columns, "Doing").id,
      firstToStart: "move",
    });

    expectOneCommitAndOneSettled(outcome);
  });

  it("settles both when the move splices across the removed column, the delete queued first", async () => {
    const board = await seedBoard();

    const outcome = await raceMoveAgainstDelete({
      actor: board.actor,
      projectId: board.projectId,
      movedId: columnNamed(board.columns, "Backlog").id,
      targetColumnId: columnNamed(board.columns, "Done").id,
      placement: "after",
      deletedColumnId: columnNamed(board.columns, "Doing").id,
      firstToStart: "delete",
    });

    expectOneCommitAndOneSettled(outcome);
  });

  it("answers not_found, never invalid_target, when the delete removes the move's own target first", async () => {
    const board = await seedBoard();
    const doing = columnNamed(board.columns, "Doing");

    const outcome = await raceMoveAgainstDelete({
      actor: board.actor,
      projectId: board.projectId,
      movedId: columnNamed(board.columns, "Backlog").id,
      targetColumnId: doing.id,
      placement: "after",
      deletedColumnId: doing.id,
      firstToStart: "delete",
    });

    expectOneCommitAndOneSettled(outcome);
    expect(outcome.deletion).toEqual({ ok: true });
    expect(outcome.movement).toEqual({ ok: false, error: "not_found" });
  });

  it("commits the move and then the delete when the move takes the lock first", async () => {
    const board = await seedBoard();
    const doing = columnNamed(board.columns, "Doing");

    const outcome = await raceMoveAgainstDelete({
      actor: board.actor,
      projectId: board.projectId,
      movedId: columnNamed(board.columns, "Backlog").id,
      targetColumnId: doing.id,
      placement: "after",
      deletedColumnId: doing.id,
      firstToStart: "move",
    });

    expectOneCommitAndOneSettled(outcome);
    expect(outcome.movement).toEqual({ ok: true });
    expect(outcome.deletion).toEqual({ ok: true });
  });
});