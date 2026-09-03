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

async function insertProjectWithColumnAndCounter() {
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
  await testDb.insert(issueCounter).values({ projectId: proj.id, lastNumber: 0 });
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

function baseInput(projectId: string, actor: Actor, title: string) {
  return {
    projectId,
    actor,
    title,
    description: null,
    columnId: null,
    priority: null,
    assigneeId: null,
    dueDate: null,
  };
}

describe("createIssue — foot-of-order placement (FR-040, SC-005, edge case: base case)", () => {
  it("the first issue in an empty project receives the first index of the fractional-indexing scheme", async () => {
    const { proj } = await insertProjectWithColumnAndCounter();
    const member = await insertUser();
    await addMember(proj.id, member.id);

    await createIssue(baseInput(proj.id, actorFor(member), "First issue"));

    const [row] = await testDb.select().from(issue).where(eq(issue.projectId, proj.id));
    expect(row?.sortOrder).toBe("a0");
    expect(row?.sortOrder).not.toBe("");
  });

  it("the next issue created sorts after the previous one", async () => {
    const { proj } = await insertProjectWithColumnAndCounter();
    const member = await insertUser();
    await addMember(proj.id, member.id);

    await createIssue(baseInput(proj.id, actorFor(member), "First issue"));
    await createIssue(baseInput(proj.id, actorFor(member), "Second issue"));

    const rows = await testDb.select().from(issue).where(eq(issue.projectId, proj.id));
    const first = rows.find((row) => row.title === "First issue");
    const second = rows.find((row) => row.title === "Second issue");
    expect(first?.sortOrder).toBeDefined();
    expect(second?.sortOrder).toBeDefined();
    expect((second?.sortOrder as string) > (first?.sortOrder as string)).toBe(true);
  });

  it("creating a new issue changes no existing row's sort_order", async () => {
    const { proj } = await insertProjectWithColumnAndCounter();
    const member = await insertUser();
    await addMember(proj.id, member.id);

    await createIssue(baseInput(proj.id, actorFor(member), "First issue"));
    const [beforeRow] = await testDb.select().from(issue).where(eq(issue.projectId, proj.id));
    const sortOrderBefore = beforeRow?.sortOrder;

    await createIssue(baseInput(proj.id, actorFor(member), "Second issue"));

    const rows = await testDb.select().from(issue).where(eq(issue.projectId, proj.id));
    const first = rows.find((row) => row.title === "First issue");
    expect(first?.sortOrder).toBe(sortOrderBefore);
  });
});