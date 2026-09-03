import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { boardColumn, issueCounter, project, projectMember, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { setProjectStatus } from "./project-status";

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

async function insertProject(overrides: Partial<typeof project.$inferInsert> = {}) {
  const now = new Date();
  const [row] = await testDb
    .insert(project)
    .values({
      key: `P${crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      name: "Website Redesign",
      createdAt: now,
      updatedAt: now,
      ...overrides,
    })
    .returning();
  if (!row) {
    throw new Error("insertProject produced no row");
  }
  return row;
}

async function insertColumn(projectId: string) {
  const now = new Date();
  const [row] = await testDb
    .insert(boardColumn)
    .values({
      projectId,
      name: "Backlog",
      kind: "open",
      sortOrder: "a0",
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!row) {
    throw new Error("insertColumn produced no row");
  }
  return row;
}

async function insertCounter(projectId: string) {
  const [row] = await testDb.insert(issueCounter).values({ projectId, lastNumber: 0 }).returning();
  if (!row) {
    throw new Error("insertCounter produced no row");
  }
  return row;
}

async function insertMembership(projectId: string, userId: string) {
  const now = new Date();
  const [row] = await testDb
    .insert(projectMember)
    .values({ projectId, userId, createdAt: now, updatedAt: now })
    .returning();
  if (!row) {
    throw new Error("insertMembership produced no row");
  }
  return row;
}

describe("setProjectStatus (FR-041, FR-042, FR-043)", () => {
  it("archives an active project", async () => {
    const proj = await insertProject({ status: "active" });

    await setProjectStatus(proj.id, "archived");

    const [row] = await testDb.select().from(project).where(eq(project.id, proj.id));
    expect(row?.status).toBe("archived");
  });

  it("reopens an archived project — both transitions are legal", async () => {
    const proj = await insertProject({ status: "archived" });

    await setProjectStatus(proj.id, "active");

    const [row] = await testDb.select().from(project).where(eq(project.id, proj.id));
    expect(row?.status).toBe("active");
  });

  it("writes updated_at through touched()", async () => {
    const proj = await insertProject({ status: "active", updatedAt: new Date("2020-01-01T00:00:00Z") });

    await setProjectStatus(proj.id, "archived");

    const [row] = await testDb.select().from(project).where(eq(project.id, proj.id));
    expect(row?.updatedAt.getTime()).toBeGreaterThan(new Date("2020-01-01T00:00:00Z").getTime());
  });

  it("archiving touches no column, no membership and no counter row", async () => {
    const proj = await insertProject({ status: "active" });
    const member = await insertUser();
    const column = await insertColumn(proj.id);
    const membership = await insertMembership(proj.id, member.id);
    const counter = await insertCounter(proj.id);

    await setProjectStatus(proj.id, "archived");

    const [columnRow] = await testDb.select().from(boardColumn).where(eq(boardColumn.id, column.id));
    expect(columnRow?.updatedAt).toEqual(column.updatedAt);
    const [membershipRow] = await testDb
      .select()
      .from(projectMember)
      .where(eq(projectMember.projectId, proj.id));
    expect(membershipRow?.updatedAt).toEqual(membership.updatedAt);
    const [counterRow] = await testDb.select().from(issueCounter).where(eq(issueCounter.id, counter.id));
    expect(counterRow?.lastNumber).toBe(counter.lastNumber);
  });

  it("reopening touches no column, no membership and no counter row", async () => {
    const proj = await insertProject({ status: "archived" });
    const member = await insertUser();
    const column = await insertColumn(proj.id);
    const membership = await insertMembership(proj.id, member.id);
    const counter = await insertCounter(proj.id);

    await setProjectStatus(proj.id, "active");

    const [columnRow] = await testDb.select().from(boardColumn).where(eq(boardColumn.id, column.id));
    expect(columnRow?.updatedAt).toEqual(column.updatedAt);
    const [membershipRow] = await testDb
      .select()
      .from(projectMember)
      .where(eq(projectMember.projectId, proj.id));
    expect(membershipRow?.updatedAt).toEqual(membership.updatedAt);
    const [counterRow] = await testDb.select().from(issueCounter).where(eq(issueCounter.id, counter.id));
    expect(counterRow?.lastNumber).toBe(counter.lastNumber);
  });
});