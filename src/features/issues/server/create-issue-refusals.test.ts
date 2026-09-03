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

function baseInput(
  projectId: string,
  actor: Actor,
  overrides: Partial<Parameters<typeof createIssue>[0]> = {},
) {
  return {
    projectId,
    actor,
    title: "Fix the header",
    description: null,
    columnId: null,
    priority: null,
    assigneeId: null,
    dueDate: null,
    ...overrides,
  };
}

describe("createIssue — refusals (FR-022, FR-030, FR-037, FR-066, SC-016, US1 s4)", () => {
  it("refuses a whitespace-only title and writes nothing", async () => {
    const { proj } = await insertProjectWithColumnAndCounter();
    const member = await insertUser();
    await addMember(proj.id, member.id);

    const result = await createIssue(baseInput(proj.id, actorFor(member), { title: "   " }));

    expect(result).toEqual({ status: "invalid", field: "title", reason: "required" });
    const rows = await testDb.select().from(issue).where(eq(issue.projectId, proj.id));
    expect(rows).toHaveLength(0);
  });

  it("refuses a 201-character title, naming the field, without truncating it", async () => {
    const { proj } = await insertProjectWithColumnAndCounter();
    const member = await insertUser();
    await addMember(proj.id, member.id);

    const result = await createIssue(baseInput(proj.id, actorFor(member), { title: "a".repeat(201) }));

    expect(result).toEqual({ status: "invalid", field: "title", reason: "too-long" });
    const rows = await testDb.select().from(issue).where(eq(issue.projectId, proj.id));
    expect(rows).toHaveLength(0);
  });

  it("refuses a 10001-character description, naming the field, without truncating it", async () => {
    const { proj } = await insertProjectWithColumnAndCounter();
    const member = await insertUser();
    await addMember(proj.id, member.id);

    const result = await createIssue(
      baseInput(proj.id, actorFor(member), { description: "a".repeat(10001) }),
    );

    expect(result).toEqual({ status: "invalid", field: "description", reason: "too-long" });
    const rows = await testDb.select().from(issue).where(eq(issue.projectId, proj.id));
    expect(rows).toHaveLength(0);
  });

  it("refuses an assignee outside the project's pool", async () => {
    const { proj } = await insertProjectWithColumnAndCounter();
    const member = await insertUser();
    await addMember(proj.id, member.id);
    const outsider = await insertUser({ firstName: "Not", lastName: "In Pool" });

    const result = await createIssue(baseInput(proj.id, actorFor(member), { assigneeId: outsider.id }));

    expect(result).toEqual({
      status: "invalid",
      field: "assigneeId",
      reason: "not-a-member-of-this-project",
    });
    const rows = await testDb.select().from(issue).where(eq(issue.projectId, proj.id));
    expect(rows).toHaveLength(0);
  });

  it("refuses a column that does not belong to this project", async () => {
    const { proj } = await insertProjectWithColumnAndCounter();
    const other = await insertProjectWithColumnAndCounter();
    const member = await insertUser();
    await addMember(proj.id, member.id);

    const result = await createIssue(baseInput(proj.id, actorFor(member), { columnId: other.column.id }));

    expect(result).toEqual({ status: "invalid", field: "columnId", reason: "unknown-value" });
    const rows = await testDb.select().from(issue).where(eq(issue.projectId, proj.id));
    expect(rows).toHaveLength(0);
  });

  it("refuses when the project's issue-counter row is missing, rather than creating one", async () => {
    const now = new Date();
    const [proj] = await testDb
      .insert(project)
      .values({
        key: `P${crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`,
        name: "No Counter",
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    if (!proj) throw new Error("insertProject produced no row");
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
    if (!column) throw new Error("insertColumn produced no row");
    const member = await insertUser();
    await addMember(proj.id, member.id);

    const result = await createIssue(baseInput(proj.id, actorFor(member)));

    expect(result).toEqual({ status: "no-counter" });
    const counters = await testDb.select().from(issueCounter).where(eq(issueCounter.projectId, proj.id));
    expect(counters).toHaveLength(0);
    const rows = await testDb.select().from(issue).where(eq(issue.projectId, proj.id));
    expect(rows).toHaveLength(0);
  });

  it("refuses a non-member reaching createIssue directly, independent of any route guard", async () => {
    const { proj } = await insertProjectWithColumnAndCounter();
    const outsider = await insertUser({ firstName: "Not", lastName: "A Member" });

    const result = await createIssue(baseInput(proj.id, actorFor(outsider)));

    expect(result.status).toBe("forbidden");
    const rows = await testDb.select().from(issue).where(eq(issue.projectId, proj.id));
    expect(rows).toHaveLength(0);
  });

  it("an admin with no membership row may still create an issue", async () => {
    const { proj } = await insertProjectWithColumnAndCounter();
    const admin = await insertUser({ firstName: "Admin", lastName: "NoRow", role: "admin" });

    const result = await createIssue(baseInput(proj.id, actorFor(admin)));

    expect(result.status).toBe("ok");
  });
});