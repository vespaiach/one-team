import { beforeEach, describe, expect, it } from "vitest";
import { boardColumn, issue, notification, project, projectMember, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import type { Actor } from "@/features/auth/server/actor";
import { moveIssue } from "./move-issue";

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

async function insertProjectWithColumns() {
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
  const columns = await testDb
    .insert(boardColumn)
    .values([
      { projectId: proj.id, name: "Backlog", kind: "open", sortOrder: "a0", createdAt: now, updatedAt: now },
      { projectId: proj.id, name: "Doing", kind: "open", sortOrder: "a1", createdAt: now, updatedAt: now },
    ])
    .returning();
  const [backlog, doing] = columns;
  if (!backlog || !doing) {
    throw new Error("insertColumns produced no rows");
  }
  return { proj, backlog, doing };
}

async function insertIssueRow(
  projectId: string,
  columnId: string,
  createdBy: string,
  overrides: { number: number; sortOrder: string; assigneeId?: string | null },
) {
  const now = new Date();
  const [row] = await testDb
    .insert(issue)
    .values({
      projectId,
      title: "Fix the header",
      columnId,
      createdBy,
      priority: "none",
      assigneeId: overrides.assigneeId ?? null,
      number: overrides.number,
      sortOrder: overrides.sortOrder,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!row) {
    throw new Error("insertIssue produced no row");
  }
  return row;
}

async function addMember(projectId: string, userId: string) {
  const now = new Date();
  await testDb.insert(projectMember).values({ projectId, userId, createdAt: now, updatedAt: now });
}

function actorFor(userRow: typeof user.$inferSelect): Actor {
  return {
    id: userRow.id,
    role: userRow.role,
    firstName: userRow.firstName,
    lastName: userRow.lastName,
    avatarUrl: null,
    mustChangePassword: false,
  };
}

async function census() {
  return testDb.select().from(notification);
}

describe("moveIssue — a cross-lane drop under Assignee grouping (FR-050)", () => {
  it("writes exactly one assignment row for the lane's person", async () => {
    const { proj, backlog } = await insertProjectWithColumns();
    const mover = await insertUser();
    const assignee = await insertUser();
    await addMember(proj.id, mover.id);
    await addMember(proj.id, assignee.id);
    const issueRow = await insertIssueRow(proj.id, backlog.id, mover.id, { number: 1, sortOrder: "a0" });
    const before = await census();

    const result = await moveIssue({
      actor: actorFor(mover),
      issueId: issueRow.id,
      grouping: "assignee",
      laneId: assignee.id,
      targetIssueId: null,
      placement: "after",
    });

    expect(result).toEqual({ ok: true });
    const after = await census();
    expect(after).toHaveLength(before.length + 1);
    expect(after[0]).toMatchObject({
      userId: assignee.id,
      actorId: mover.id,
      type: "assignment",
      issueId: issueRow.id,
      projectId: null,
      commentId: null,
    });
  });
});

describe("moveIssue — the drops that write nothing (FR-051, SC-008)", () => {
  it("writes nothing for a drop into Unassigned", async () => {
    const { proj, backlog } = await insertProjectWithColumns();
    const mover = await insertUser();
    const assignee = await insertUser();
    await addMember(proj.id, mover.id);
    await addMember(proj.id, assignee.id);
    const issueRow = await insertIssueRow(proj.id, backlog.id, mover.id, {
      number: 1,
      sortOrder: "a0",
      assigneeId: assignee.id,
    });
    const before = await census();

    const result = await moveIssue({
      actor: actorFor(mover),
      issueId: issueRow.id,
      grouping: "assignee",
      laneId: null,
      targetIssueId: null,
      placement: "after",
    });

    expect(result).toEqual({ ok: true });
    expect(await census()).toEqual(before);
  });

  it("writes nothing for a reorder inside one assignee lane", async () => {
    const { proj, backlog } = await insertProjectWithColumns();
    const mover = await insertUser();
    const assignee = await insertUser();
    await addMember(proj.id, mover.id);
    await addMember(proj.id, assignee.id);
    const first = await insertIssueRow(proj.id, backlog.id, mover.id, {
      number: 1,
      sortOrder: "a0",
      assigneeId: assignee.id,
    });
    const second = await insertIssueRow(proj.id, backlog.id, mover.id, {
      number: 2,
      sortOrder: "a1",
      assigneeId: assignee.id,
    });
    const before = await census();

    const result = await moveIssue({
      actor: actorFor(mover),
      issueId: first.id,
      grouping: "assignee",
      laneId: assignee.id,
      targetIssueId: second.id,
      placement: "after",
    });

    expect(result).toEqual({ ok: true });
    expect(await census()).toEqual(before);
  });

  it("writes nothing for a drop under Column grouping", async () => {
    const { proj, backlog, doing } = await insertProjectWithColumns();
    const mover = await insertUser();
    await addMember(proj.id, mover.id);
    const issueRow = await insertIssueRow(proj.id, backlog.id, mover.id, { number: 1, sortOrder: "a0" });
    const before = await census();

    const result = await moveIssue({
      actor: actorFor(mover),
      issueId: issueRow.id,
      grouping: "column",
      laneId: doing.id,
      targetIssueId: null,
      placement: "after",
    });

    expect(result).toEqual({ ok: true });
    expect(await census()).toEqual(before);
  });

  it("writes nothing for a drop under Priority grouping", async () => {
    const { proj, backlog } = await insertProjectWithColumns();
    const mover = await insertUser();
    await addMember(proj.id, mover.id);
    const issueRow = await insertIssueRow(proj.id, backlog.id, mover.id, { number: 1, sortOrder: "a0" });
    const before = await census();

    const result = await moveIssue({
      actor: actorFor(mover),
      issueId: issueRow.id,
      grouping: "priority",
      laneId: "urgent",
      targetIssueId: null,
      placement: "after",
    });

    expect(result).toEqual({ ok: true });
    expect(await census()).toEqual(before);
  });
});