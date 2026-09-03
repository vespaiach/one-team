import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { boardColumn, issue, issueCounter, project, projectMember, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import type { Actor } from "@/features/auth/server/actor";
import { createIssue } from "./create-issue";

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
  const [first] = await testDb
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
  const [second] = await testDb
    .insert(boardColumn)
    .values({
      projectId: proj.id,
      name: "Todo",
      kind: "open",
      sortOrder: "a1",
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!first || !second) {
    throw new Error("insertColumn produced no row");
  }
  await testDb.insert(issueCounter).values({ projectId: proj.id, lastNumber: 0 });
  return { proj, first, second };
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

describe("createIssue — defaults when a field is absent (FR-003, FR-032, FR-033, FR-034, FR-035, US1 s1)", () => {
  it("a title alone yields the project's first column by board position, priority none, no assignee, no due date", async () => {
    const { proj, first } = await insertProjectWithColumns();
    const member = await insertUser();
    await addMember(proj.id, member.id);

    const result = await createIssue({
      projectId: proj.id,
      actor: actorFor(member),
      title: "Fix the header",
      description: null,
      columnId: null,
      priority: null,
      assigneeId: null,
      dueDate: null,
    });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("expected ok");

    const [row] = await testDb.select().from(issue).where(eq(issue.projectId, proj.id));
    expect(row?.columnId).toBe(first.id);
    expect(row?.priority).toBe("none");
    expect(row?.assigneeId).toBeNull();
    expect(row?.dueDate).toBeNull();
  });

  it("created_by is the actor, and created_at/updated_at are written explicitly", async () => {
    const { proj } = await insertProjectWithColumns();
    const member = await insertUser();
    await addMember(proj.id, member.id);
    const before = new Date();

    await createIssue({
      projectId: proj.id,
      actor: actorFor(member),
      title: "Fix the header",
      description: null,
      columnId: null,
      priority: null,
      assigneeId: null,
      dueDate: null,
    });

    const [row] = await testDb.select().from(issue).where(eq(issue.projectId, proj.id));
    expect(row?.createdBy).toBe(member.id);
    expect(row?.createdAt).toBeInstanceOf(Date);
    expect(row?.updatedAt).toBeInstanceOf(Date);
    expect((row?.createdAt as Date).getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(Math.abs((row?.createdAt as Date).getTime() - (row?.updatedAt as Date).getTime())).toBeLessThan(
      1000,
    );
  });

  it("the whole write is one database transaction: a failure after the draw leaves no issue row behind", async () => {
    const { proj, first } = await insertProjectWithColumns();
    const member = await insertUser();
    await addMember(proj.id, member.id);
    const now = new Date();
    await testDb.insert(issue).values({
      projectId: proj.id,
      number: 1,
      title: "Manually inserted",
      columnId: first.id,
      createdBy: member.id,
      sortOrder: "a0",
      createdAt: now,
      updatedAt: now,
    });

    await expect(
      createIssue({
        projectId: proj.id,
        actor: actorFor(member),
        title: "Fix the header",
        description: null,
        columnId: null,
        priority: null,
        assigneeId: null,
        dueDate: null,
      }),
    ).rejects.toThrow();

    const rows = await testDb.select().from(issue).where(eq(issue.projectId, proj.id));
    expect(rows).toHaveLength(1);
  });
});