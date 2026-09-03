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

async function insertProjectWithColumn(columnName = "Backlog") {
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
      name: columnName,
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

async function insertIssue(projectId: string, columnId: string, createdBy: string) {
  const now = new Date();
  const [row] = await testDb
    .insert(issue)
    .values({
      projectId,
      number: 1,
      title: "Fix the header",
      columnId,
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

describe("updateIssue — refusals (FR-022, FR-049, FR-052, FR-065, SC-016, SC-020, edge case: column deleted)", () => {
  it("refuses a column belonging to another project, by the database rather than an application lookup", async () => {
    const { proj, column } = await insertProjectWithColumn();
    const { column: otherColumn } = await insertProjectWithColumn();
    const member = await insertUser();
    await addMember(proj.id, member.id);
    const created = await insertIssue(proj.id, column.id, member.id);

    const result = await updateIssue({
      issueId: created.id,
      actor: actorFor(member),
      columnId: otherColumn.id,
    });

    expect(result).toMatchObject({ status: "invalid", field: "columnId" });
    const [row] = await testDb.select().from(issue).where(eq(issue.id, created.id));
    expect(row?.columnId).toBe(column.id);
  });

  it("refuses a column id naming no row at all, the same way a column deleted out from under the edit would be refused", async () => {
    const { proj, column } = await insertProjectWithColumn();
    const member = await insertUser();
    await addMember(proj.id, member.id);
    const created = await insertIssue(proj.id, column.id, member.id);

    const result = await updateIssue({
      issueId: created.id,
      actor: actorFor(member),
      columnId: crypto.randomUUID(),
    });

    expect(result).toMatchObject({ status: "invalid", field: "columnId" });
  });

  it("refuses an assignee outside the project's pool", async () => {
    const { proj, column } = await insertProjectWithColumn();
    const member = await insertUser();
    const outsider = await insertUser({ email: `outsider-${crypto.randomUUID()}@example.com` });
    await addMember(proj.id, member.id);
    const created = await insertIssue(proj.id, column.id, member.id);

    const result = await updateIssue({
      issueId: created.id,
      actor: actorFor(member),
      assigneeId: outsider.id,
    });

    expect(result).toMatchObject({
      status: "invalid",
      field: "assigneeId",
      reason: "not-a-member-of-this-project",
    });
    const [row] = await testDb.select().from(issue).where(eq(issue.id, created.id));
    expect(row?.assigneeId).toBeNull();
  });

  it("refuses an over-length title without truncating it", async () => {
    const { proj, column } = await insertProjectWithColumn();
    const member = await insertUser();
    await addMember(proj.id, member.id);
    const created = await insertIssue(proj.id, column.id, member.id);
    const overLong = "a".repeat(201);

    const result = await updateIssue({ issueId: created.id, actor: actorFor(member), title: overLong });

    expect(result).toMatchObject({ status: "invalid", field: "title", reason: "too-long" });
    const [row] = await testDb.select().from(issue).where(eq(issue.id, created.id));
    expect(row?.title).toBe(created.title);
  });

  it("refuses an over-length description without truncating it", async () => {
    const { proj, column } = await insertProjectWithColumn();
    const member = await insertUser();
    await addMember(proj.id, member.id);
    const created = await insertIssue(proj.id, column.id, member.id);
    const overLong = "a".repeat(10001);

    const result = await updateIssue({ issueId: created.id, actor: actorFor(member), description: overLong });

    expect(result).toMatchObject({ status: "invalid", field: "description", reason: "too-long" });
    const [row] = await testDb.select().from(issue).where(eq(issue.id, created.id));
    expect(row?.description).toBe(created.description);
  });

  it("a refusal carries no SQL, constraint name or stack trace", async () => {
    const { proj, column } = await insertProjectWithColumn();
    const { column: otherColumn } = await insertProjectWithColumn();
    const member = await insertUser();
    await addMember(proj.id, member.id);
    const created = await insertIssue(proj.id, column.id, member.id);

    const result = await updateIssue({
      issueId: created.id,
      actor: actorFor(member),
      columnId: otherColumn.id,
    });

    const serialized = JSON.stringify(result);
    expect(serialized).not.toMatch(/select|insert|update|delete|constraint|at\s+\S+:\d+:\d+/i);
  });
});