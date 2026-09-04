import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { activity, boardColumn, issue, project, projectMember, user } from "@/db/schema";
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
  const [backlog] = await testDb
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
  const [inProgress] = await testDb
    .insert(boardColumn)
    .values({
      projectId: proj.id,
      name: "In Progress",
      kind: "open",
      sortOrder: "a1",
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!backlog || !inProgress) {
    throw new Error("insertColumn produced no row");
  }
  return { proj, backlog, inProgress };
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

describe("updateIssue — activity (FR-056, SC-003)", () => {
  it("writes one field_changed row naming 'title' alone, with the old and new values", async () => {
    const { proj, backlog } = await insertProjectWithColumns();
    const member = await insertUser();
    await addMember(proj.id, member.id);
    const created = await insertIssue(proj.id, backlog.id, member.id);

    await updateIssue({ issueId: created.id, actor: actorFor(member), title: "New title" });

    const rows = await testDb.select().from(activity).where(eq(activity.issueId, created.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: "field_changed",
      actorId: member.id,
      field: "title",
      fromValue: "Fix the header",
      toValue: "New title",
    });
  });

  it("writes one field_changed row naming 'priority' alone", async () => {
    const { proj, backlog } = await insertProjectWithColumns();
    const member = await insertUser();
    await addMember(proj.id, member.id);
    const created = await insertIssue(proj.id, backlog.id, member.id, { priority: "low" });

    await updateIssue({ issueId: created.id, actor: actorFor(member), priority: "urgent" });

    const rows = await testDb.select().from(activity).where(eq(activity.issueId, created.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ field: "priority", fromValue: "low", toValue: "urgent" });
  });

  it("writes one field_changed row naming 'due_date' alone", async () => {
    const { proj, backlog } = await insertProjectWithColumns();
    const member = await insertUser();
    await addMember(proj.id, member.id);
    const created = await insertIssue(proj.id, backlog.id, member.id, { dueDate: "2026-01-01" });

    await updateIssue({ issueId: created.id, actor: actorFor(member), dueDate: "2026-06-15" });

    const rows = await testDb.select().from(activity).where(eq(activity.issueId, created.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ field: "due_date", fromValue: "2026-01-01", toValue: "2026-06-15" });
  });

  it("a changed column freezes the column's name, not its id, on both from_value and to_value", async () => {
    const { proj, backlog, inProgress } = await insertProjectWithColumns();
    const member = await insertUser();
    await addMember(proj.id, member.id);
    const created = await insertIssue(proj.id, backlog.id, member.id);

    await updateIssue({ issueId: created.id, actor: actorFor(member), columnId: inProgress.id });

    const rows = await testDb.select().from(activity).where(eq(activity.issueId, created.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ field: "column", fromValue: "Backlog", toValue: "In Progress" });
  });

  it("a changed assignee freezes the person's name, not its id, on both from_value and to_value", async () => {
    const { proj, backlog } = await insertProjectWithColumns();
    const member = await insertUser();
    const assignee = await insertUser({
      firstName: "Grace",
      lastName: "Hopper",
      email: `assignee-${crypto.randomUUID()}@example.com`,
    });
    await addMember(proj.id, member.id);
    await addMember(proj.id, assignee.id);
    const created = await insertIssue(proj.id, backlog.id, member.id);

    await updateIssue({ issueId: created.id, actor: actorFor(member), assigneeId: assignee.id });

    const rows = await testDb.select().from(activity).where(eq(activity.issueId, created.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ field: "assignee", fromValue: null, toValue: "Grace Hopper" });
  });

  it("clearing an assignee writes from_value as the prior name and to_value as null", async () => {
    const { proj, backlog } = await insertProjectWithColumns();
    const member = await insertUser();
    const assignee = await insertUser({
      firstName: "Grace",
      lastName: "Hopper",
      email: `assignee-${crypto.randomUUID()}@example.com`,
    });
    await addMember(proj.id, member.id);
    await addMember(proj.id, assignee.id);
    const created = await insertIssue(proj.id, backlog.id, member.id, { assigneeId: assignee.id });

    await updateIssue({ issueId: created.id, actor: actorFor(member), assigneeId: null });

    const rows = await testDb.select().from(activity).where(eq(activity.issueId, created.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ field: "assignee", fromValue: "Grace Hopper", toValue: null });
  });

  it("writes nothing when the named values all match the stored row", async () => {
    const { proj, backlog } = await insertProjectWithColumns();
    const member = await insertUser();
    await addMember(proj.id, member.id);
    const created = await insertIssue(proj.id, backlog.id, member.id);

    const result = await updateIssue({
      issueId: created.id,
      actor: actorFor(member),
      title: created.title,
    });

    expect(result.status).toBe("ok");
    const rows = await testDb.select().from(activity).where(eq(activity.issueId, created.id));
    expect(rows).toHaveLength(0);
  });
});