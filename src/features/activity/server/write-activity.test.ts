import { eq, TransactionRollbackError } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { activity, comment, project, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { writeActivity } from "./write-activity";

beforeEach(async () => {
  await truncateTestDatabase();
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

async function insertProject(overrides: Partial<typeof project.$inferInsert> = {}) {
  const now = new Date();
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

async function insertComment(authorId: string, projectId: string) {
  const now = new Date();
  const [row] = await testDb
    .insert(comment)
    .values({ authorId, body: "Looks good.", projectId, createdAt: now, updatedAt: now })
    .returning();
  if (!row) {
    throw new Error("insertComment produced no row");
  }
  return row;
}

describe("writeActivity (FR-011, FR-013, contracts/mutators.md)", () => {
  it.each([
    ["created", {}],
    ["field_changed", { field: "name", fromValue: "Old", toValue: "New" }],
    ["member_added", { toValue: "Ada Lovelace" }],
    ["member_removed", { fromValue: "Ada Lovelace" }],
    ["archived", {}],
    ["reopened", {}],
  ] as const)("inserts exactly one %s row carrying the passed fields", async (type, extra) => {
    const actorRow = await insertUser();
    const projectRow = await insertProject();

    await testDb.transaction(async (tx) => {
      await writeActivity(tx, { type, target: { projectId: projectRow.id }, actorId: actorRow.id, ...extra });
    });

    const rows = await testDb.select().from(activity).where(eq(activity.projectId, projectRow.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type,
      actorId: actorRow.id,
      projectId: projectRow.id,
      issueId: null,
      field: "field" in extra ? extra.field : null,
      fromValue: "fromValue" in extra ? extra.fromValue : null,
      toValue: "toValue" in extra ? extra.toValue : null,
      commentId: null,
    });
  });

  it("inserts exactly one comment row carrying the passed comment id", async () => {
    const actorRow = await insertUser();
    const projectRow = await insertProject();
    const commentRow = await insertComment(actorRow.id, projectRow.id);

    await testDb.transaction(async (tx) => {
      await writeActivity(tx, {
        type: "comment",
        target: { projectId: projectRow.id },
        actorId: actorRow.id,
        commentId: commentRow.id,
      });
    });

    const rows = await testDb.select().from(activity).where(eq(activity.projectId, projectRow.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: "comment",
      actorId: actorRow.id,
      commentId: commentRow.id,
      field: null,
      fromValue: null,
      toValue: null,
    });
  });

  it("opens no transaction of its own — its row exists only inside the caller's own transaction", async () => {
    const actorRow = await insertUser();
    const projectRow = await insertProject();
    let rowCountInsideTransaction = -1;

    await expect(
      testDb.transaction(async (tx) => {
        await writeActivity(tx, {
          type: "created",
          target: { projectId: projectRow.id },
          actorId: actorRow.id,
        });
        const rowsInsideTx = await tx.select().from(activity).where(eq(activity.projectId, projectRow.id));
        rowCountInsideTransaction = rowsInsideTx.length;
        tx.rollback();
      }),
    ).rejects.toThrow(TransactionRollbackError);

    expect(rowCountInsideTransaction).toBe(1);

    const rowsAfterRollback = await testDb
      .select()
      .from(activity)
      .where(eq(activity.projectId, projectRow.id));
    expect(rowsAfterRollback).toHaveLength(0);
  });

  it("performs no authorization of its own — writes for an actor with no membership row", async () => {
    const actorRow = await insertUser();
    const projectRow = await insertProject();

    await testDb.transaction(async (tx) => {
      await writeActivity(tx, {
        type: "created",
        target: { projectId: projectRow.id },
        actorId: actorRow.id,
      });
    });

    const rows = await testDb.select().from(activity).where(eq(activity.projectId, projectRow.id));
    expect(rows).toHaveLength(1);
  });
});