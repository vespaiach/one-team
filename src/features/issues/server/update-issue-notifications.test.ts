import { beforeEach, describe, expect, it } from "vitest";
import { boardColumn, issue, notification, project, projectMember, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import type { Actor } from "@/features/auth/server/actor";
import { updateIssue } from "./update-issue";

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
  assigneeId: string | null,
) {
  const now = new Date();
  const [row] = await testDb
    .insert(issue)
    .values({
      projectId,
      number: 1,
      title: "Fix the header",
      columnId,
      createdBy,
      assigneeId,
      priority: "none",
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

describe("updateIssue — the rail edit that sets an assignee (FR-050)", () => {
  it("writes exactly one assignment row for the newly chosen person", async () => {
    const { proj, backlog } = await insertProjectWithColumns();
    const editor = await insertUser();
    const assignee = await insertUser();
    await addMember(proj.id, editor.id);
    await addMember(proj.id, assignee.id);
    const issueRow = await insertIssueRow(proj.id, backlog.id, editor.id, null);
    const before = await census();

    const result = await updateIssue({
      issueId: issueRow.id,
      actor: actorFor(editor),
      assigneeId: assignee.id,
    });

    expect(result.status).toBe("ok");
    const after = await census();
    expect(after).toHaveLength(before.length + 1);
    expect(after[0]).toMatchObject({
      userId: assignee.id,
      actorId: editor.id,
      type: "assignment",
      issueId: issueRow.id,
      projectId: null,
      commentId: null,
    });
  });
});

describe("updateIssue — the edits that write nothing (FR-051, SC-008)", () => {
  it("writes nothing when the assignee already set is re-selected", async () => {
    const { proj, backlog } = await insertProjectWithColumns();
    const editor = await insertUser();
    const assignee = await insertUser();
    await addMember(proj.id, editor.id);
    await addMember(proj.id, assignee.id);
    const issueRow = await insertIssueRow(proj.id, backlog.id, editor.id, assignee.id);
    const before = await census();

    const result = await updateIssue({
      issueId: issueRow.id,
      actor: actorFor(editor),
      assigneeId: assignee.id,
    });

    expect(result.status).toBe("ok");
    expect(await census()).toEqual(before);
  });

  it("writes nothing when the assignee is cleared", async () => {
    const { proj, backlog } = await insertProjectWithColumns();
    const editor = await insertUser();
    const assignee = await insertUser();
    await addMember(proj.id, editor.id);
    await addMember(proj.id, assignee.id);
    const issueRow = await insertIssueRow(proj.id, backlog.id, editor.id, assignee.id);
    const before = await census();

    const result = await updateIssue({
      issueId: issueRow.id,
      actor: actorFor(editor),
      assigneeId: null,
    });

    expect(result.status).toBe("ok");
    expect(await census()).toEqual(before);
  });

  it("writes nothing for a change to priority, column, title or due date alone", async () => {
    const { proj, backlog, doing } = await insertProjectWithColumns();
    const editor = await insertUser();
    const assignee = await insertUser();
    await addMember(proj.id, editor.id);
    await addMember(proj.id, assignee.id);
    const issueRow = await insertIssueRow(proj.id, backlog.id, editor.id, assignee.id);
    const before = await census();

    for (const fields of [
      { priority: "high" },
      { columnId: doing.id },
      { title: "Fix the footer" },
      { dueDate: "2026-06-15" },
    ]) {
      const result = await updateIssue({ issueId: issueRow.id, actor: actorFor(editor), ...fields });
      expect(result.status).toBe("ok");
    }

    expect(await census()).toEqual(before);
  });
});