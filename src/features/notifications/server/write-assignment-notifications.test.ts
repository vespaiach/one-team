import { eq, TransactionRollbackError } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { boardColumn, issue, notification, project, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { writeAssignmentNotifications } from "./write-notifications";

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

async function insertIssueRow(createdBy: string) {
  const now = new Date();
  const [proj] = await testDb
    .insert(project)
    .values({
      key: `P${crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      name: "Website Redesign",
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!proj) {
    throw new Error("insertProject produced no row");
  }
  const [column] = await testDb
    .insert(boardColumn)
    .values({
      projectId: proj.id,
      name: "Backlog",
      kind: "open",
      sortOrder: "a0",
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!column) {
    throw new Error("insertColumn produced no row");
  }
  const [row] = await testDb
    .insert(issue)
    .values({
      projectId: proj.id,
      number: 1,
      title: "Fix the header",
      columnId: column.id,
      createdBy,
      sortOrder: "a0",
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!row) {
    throw new Error("insertIssue produced no row");
  }
  return row;
}

async function census() {
  return testDb.select().from(notification);
}

describe("writeAssignmentNotifications — the sets it refuses to write (FR-038, FR-039, SC-004, SC-005)", () => {
  it("returns [] and writes nothing for a null assignee", async () => {
    const actor = await insertUser();
    const issueRow = await insertIssueRow(actor.id);
    const before = await census();

    const written = await testDb.transaction((tx) =>
      writeAssignmentNotifications(tx, { issueId: issueRow.id, assigneeId: null, actorId: actor.id }),
    );

    expect(written).toEqual([]);
    expect(await census()).toEqual(before);
  });

  it("returns [] and writes nothing when the assignee is the actor", async () => {
    const actor = await insertUser();
    const issueRow = await insertIssueRow(actor.id);
    const before = await census();

    const written = await testDb.transaction((tx) =>
      writeAssignmentNotifications(tx, { issueId: issueRow.id, assigneeId: actor.id, actorId: actor.id }),
    );

    expect(written).toEqual([]);
    expect(await census()).toEqual(before);
  });

  it("returns [] and writes nothing for a deactivated assignee", async () => {
    const actor = await insertUser();
    const assignee = await insertUser({ deactivatedAt: new Date() });
    const issueRow = await insertIssueRow(actor.id);
    const before = await census();

    const written = await testDb.transaction((tx) =>
      writeAssignmentNotifications(tx, {
        issueId: issueRow.id,
        assigneeId: assignee.id,
        actorId: actor.id,
      }),
    );

    expect(written).toEqual([]);
    expect(await census()).toEqual(before);
  });
});

describe("writeAssignmentNotifications — the one row it writes (FR-050, FR-052)", () => {
  it("writes exactly one assignment row carrying the issue, no project, no comment and no attempts", async () => {
    const actor = await insertUser();
    const assignee = await insertUser();
    const issueRow = await insertIssueRow(actor.id);

    const written = await testDb.transaction((tx) =>
      writeAssignmentNotifications(tx, {
        issueId: issueRow.id,
        assigneeId: assignee.id,
        actorId: actor.id,
      }),
    );

    const rows = await census();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId: assignee.id,
      actorId: actor.id,
      type: "assignment",
      issueId: issueRow.id,
      projectId: null,
      commentId: null,
      sendAttempts: 0,
      readAt: null,
      emailedAt: null,
    });
    expect(written).toEqual([rows[0]?.id]);
  });
});

describe("writeAssignmentNotifications — every statement runs on the caller's transaction (FR-041, SC-010)", () => {
  it("writes nothing that survives when the caller's transaction rolls back", async () => {
    const actor = await insertUser();
    const assignee = await insertUser();
    const issueRow = await insertIssueRow(actor.id);
    const before = await census();

    await expect(
      testDb.transaction(async (tx) => {
        await writeAssignmentNotifications(tx, {
          issueId: issueRow.id,
          assigneeId: assignee.id,
          actorId: actor.id,
        });
        tx.rollback();
      }),
    ).rejects.toBeInstanceOf(TransactionRollbackError);

    expect(await census()).toEqual(before);
  });

  it("reads liveness through the caller's transaction, seeing a deactivation that has not committed", async () => {
    const actor = await insertUser();
    const assignee = await insertUser();
    const issueRow = await insertIssueRow(actor.id);
    let written: string[] | null = null;

    await expect(
      testDb.transaction(async (tx) => {
        await tx.update(user).set({ deactivatedAt: new Date() }).where(eq(user.id, assignee.id));
        written = await writeAssignmentNotifications(tx, {
          issueId: issueRow.id,
          assigneeId: assignee.id,
          actorId: actor.id,
        });
        tx.rollback();
      }),
    ).rejects.toBeInstanceOf(TransactionRollbackError);

    expect(written).toEqual([]);
    expect(await census()).toEqual([]);
  });
});