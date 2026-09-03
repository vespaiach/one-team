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

describe("createIssue — numbering (FR-013, FR-014, SC-003, US1 s2, US5 s5)", () => {
  it("the first issue in a project takes number 1", async () => {
    const { proj } = await insertProjectWithColumnAndCounter();
    const member = await insertUser();
    await addMember(proj.id, member.id);

    const result = await createIssue(baseInput(proj.id, actorFor(member)));

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.number).toBe(1);
    }
  });

  it("the eighth issue in a project takes number 8", async () => {
    const { proj } = await insertProjectWithColumnAndCounter();
    const member = await insertUser();
    await addMember(proj.id, member.id);

    let lastResult: Awaited<ReturnType<typeof createIssue>> | undefined;
    for (let index = 0; index < 8; index += 1) {
      lastResult = await createIssue(baseInput(proj.id, actorFor(member), { title: `Issue ${index}` }));
    }

    expect(lastResult?.status).toBe("ok");
    if (lastResult?.status === "ok") {
      expect(lastResult.number).toBe(8);
    }
  });

  it("the draw advances the counter row and touches no project row", async () => {
    const { proj } = await insertProjectWithColumnAndCounter();
    const member = await insertUser();
    await addMember(proj.id, member.id);
    const [beforeProject] = await testDb.select().from(project).where(eq(project.id, proj.id));

    await createIssue(baseInput(proj.id, actorFor(member)));

    const [counter] = await testDb.select().from(issueCounter).where(eq(issueCounter.projectId, proj.id));
    expect(counter?.lastNumber).toBe(1);
    const [afterProject] = await testDb.select().from(project).where(eq(project.id, proj.id));
    expect(afterProject?.updatedAt).toEqual(beforeProject?.updatedAt);
  });

  it("deleting the highest-numbered issue does not free its number", async () => {
    const { proj } = await insertProjectWithColumnAndCounter();
    const member = await insertUser();
    await addMember(proj.id, member.id);

    const first = await createIssue(baseInput(proj.id, actorFor(member)));
    if (first.status !== "ok") throw new Error("expected ok");
    await testDb.delete(issue).where(eq(issue.projectId, proj.id));

    const second = await createIssue(baseInput(proj.id, actorFor(member)));

    expect(second.status).toBe("ok");
    if (second.status === "ok") {
      expect(second.number).toBe(2);
    }
  });

  it("a creation that fails after drawing the number does not return it", async () => {
    const { proj, column } = await insertProjectWithColumnAndCounter();
    const member = await insertUser();
    await addMember(proj.id, member.id);
    const now = new Date();
    await testDb.insert(issue).values({
      projectId: proj.id,
      number: 1,
      title: "Manually inserted, bypassing the counter",
      columnId: column.id,
      createdBy: member.id,
      sortOrder: "a0",
      createdAt: now,
      updatedAt: now,
    });

    await expect(createIssue(baseInput(proj.id, actorFor(member)))).rejects.toThrow();

    const [counter] = await testDb.select().from(issueCounter).where(eq(issueCounter.projectId, proj.id));
    expect(counter?.lastNumber).toBe(0);

    const rows = await testDb.select().from(issue).where(eq(issue.projectId, proj.id));
    expect(rows).toHaveLength(1);
  });
});