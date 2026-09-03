import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { boardColumn, issue, project, projectMember, user } from "@/db/schema";
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

async function insertProjectWithColumn() {
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
  return { proj, column };
}

async function addMember(projectId: string, userId: string) {
  const now = new Date();
  await testDb.insert(projectMember).values({ projectId, userId, createdAt: now, updatedAt: now });
}

function actorFor(userRow: { id: string; role: string; firstName: string; lastName: string }): Actor {
  return {
    id: userRow.id,
    role: userRow.role,
    firstName: userRow.firstName,
    lastName: userRow.lastName,
    avatarUrl: null,
    mustChangePassword: false,
  };
}

async function insertIssue(
  projectId: string,
  columnId: string,
  createdBy: string,
  overrides: Partial<typeof issue.$inferInsert> = {},
) {
  const now = new Date();
  const [row] = await testDb
    .insert(issue)
    .values({
      projectId,
      number: 1,
      title: "Fix the header",
      description: "Original description",
      columnId,
      priority: "low",
      createdBy,
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

describe("updateIssue — partial-field contract (FR-006, FR-055, SC-018, US3 s6)", () => {
  it("leaves a field absent from the input untouched", async () => {
    const { proj, column } = await insertProjectWithColumn();
    const member = await insertUser();
    await addMember(proj.id, member.id);
    const created = await insertIssue(proj.id, column.id, member.id);

    const result = await updateIssue({ issueId: created.id, actor: actorFor(member), title: "New title" });

    expect(result.status).toBe("ok");
    const [row] = await testDb.select().from(issue).where(eq(issue.id, created.id));
    expect(row?.title).toBe("New title");
    expect(row?.description).toBe(created.description);
    expect(row?.columnId).toBe(created.columnId);
    expect(row?.priority).toBe(created.priority);
    expect(row?.assigneeId).toBe(created.assigneeId);
    expect(row?.dueDate).toBe(created.dueDate);
  });

  it("clears assigneeId when the input names it null", async () => {
    const { proj, column } = await insertProjectWithColumn();
    const member = await insertUser();
    const assignee = await insertUser({ email: `assignee-${crypto.randomUUID()}@example.com` });
    await addMember(proj.id, member.id);
    await addMember(proj.id, assignee.id);
    const created = await insertIssue(proj.id, column.id, member.id, { assigneeId: assignee.id });

    const result = await updateIssue({ issueId: created.id, actor: actorFor(member), assigneeId: null });

    expect(result.status).toBe("ok");
    const [row] = await testDb.select().from(issue).where(eq(issue.id, created.id));
    expect(row?.assigneeId).toBeNull();
  });

  it("clears dueDate when the input names it null", async () => {
    const { proj, column } = await insertProjectWithColumn();
    const member = await insertUser();
    await addMember(proj.id, member.id);
    const created = await insertIssue(proj.id, column.id, member.id, { dueDate: "2026-06-15" });

    const result = await updateIssue({ issueId: created.id, actor: actorFor(member), dueDate: null });

    expect(result.status).toBe("ok");
    const [row] = await testDb.select().from(issue).where(eq(issue.id, created.id));
    expect(row?.dueDate).toBeNull();
  });

  it("refuses null on title", async () => {
    const { proj, column } = await insertProjectWithColumn();
    const member = await insertUser();
    await addMember(proj.id, member.id);
    const created = await insertIssue(proj.id, column.id, member.id);

    const result = await updateIssue({ issueId: created.id, actor: actorFor(member), title: null });

    expect(result).toMatchObject({ status: "invalid", field: "title" });
  });

  it("refuses null on description", async () => {
    const { proj, column } = await insertProjectWithColumn();
    const member = await insertUser();
    await addMember(proj.id, member.id);
    const created = await insertIssue(proj.id, column.id, member.id);

    const result = await updateIssue({ issueId: created.id, actor: actorFor(member), description: null });

    expect(result).toMatchObject({ status: "invalid", field: "description" });
  });

  it("refuses null on columnId", async () => {
    const { proj, column } = await insertProjectWithColumn();
    const member = await insertUser();
    await addMember(proj.id, member.id);
    const created = await insertIssue(proj.id, column.id, member.id);

    const result = await updateIssue({ issueId: created.id, actor: actorFor(member), columnId: null });

    expect(result).toMatchObject({ status: "invalid", field: "columnId" });
  });

  it("refuses null on priority", async () => {
    const { proj, column } = await insertProjectWithColumn();
    const member = await insertUser();
    await addMember(proj.id, member.id);
    const created = await insertIssue(proj.id, column.id, member.id);

    const result = await updateIssue({ issueId: created.id, actor: actorFor(member), priority: null });

    expect(result).toMatchObject({ status: "invalid", field: "priority" });
  });

  it("a call naming one field leaves every other column byte-identical", async () => {
    const { proj, column } = await insertProjectWithColumn();
    const member = await insertUser();
    const assignee = await insertUser({ email: `assignee-${crypto.randomUUID()}@example.com` });
    await addMember(proj.id, member.id);
    await addMember(proj.id, assignee.id);
    const created = await insertIssue(proj.id, column.id, member.id, {
      assigneeId: assignee.id,
      dueDate: "2026-06-15",
    });

    await updateIssue({ issueId: created.id, actor: actorFor(member), priority: "urgent" });

    const [row] = await testDb.select().from(issue).where(eq(issue.id, created.id));
    expect(row?.priority).toBe("urgent");
    expect(row?.id).toBe(created.id);
    expect(row?.projectId).toBe(created.projectId);
    expect(row?.number).toBe(created.number);
    expect(row?.title).toBe(created.title);
    expect(row?.description).toBe(created.description);
    expect(row?.columnId).toBe(created.columnId);
    expect(row?.assigneeId).toBe(created.assigneeId);
    expect(row?.dueDate).toBe(created.dueDate);
    expect(row?.createdBy).toBe(created.createdBy);
    expect(row?.sortOrder).toBe(created.sortOrder);
    expect(row?.createdAt).toEqual(created.createdAt);
  });
});