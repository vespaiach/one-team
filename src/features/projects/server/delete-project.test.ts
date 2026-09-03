import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { boardColumn, issueCounter, project, projectMember, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { deleteProject } from "./delete-project";
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
  await testDb.insert(boardColumn).values({
    projectId,
    name: "Backlog",
    kind: "open",
    sortOrder: "a0",
    createdAt: now,
    updatedAt: now,
  });
}

async function insertCounter(projectId: string) {
  await testDb.insert(issueCounter).values({ projectId, lastNumber: 0 });
}

async function insertMembership(projectId: string, userId: string) {
  const now = new Date();
  await testDb.insert(projectMember).values({ projectId, userId, createdAt: now, updatedAt: now });
}

describe("deleteProject (FR-047, FR-049, FR-050, FR-051)", () => {
  it("refuses to delete an active project", async () => {
    const proj = await insertProject({ status: "active" });

    const result = await deleteProject(proj.id);

    expect(result).toEqual({ status: "not_archived" });
    const rows = await testDb.select().from(project).where(eq(project.id, proj.id));
    expect(rows).toHaveLength(1);
  });

  it("deletes an archived project with its columns, memberships and counter row in one transaction", async () => {
    const proj = await insertProject({ status: "archived" });
    const member = await insertUser();
    await insertColumn(proj.id);
    await insertMembership(proj.id, member.id);
    await insertCounter(proj.id);

    const result = await deleteProject(proj.id);

    expect(result).toEqual({ status: "deleted" });
    const projectRows = await testDb.select().from(project).where(eq(project.id, proj.id));
    expect(projectRows).toHaveLength(0);
    const columnRows = await testDb.select().from(boardColumn).where(eq(boardColumn.projectId, proj.id));
    expect(columnRows).toHaveLength(0);
    const memberRows = await testDb.select().from(projectMember).where(eq(projectMember.projectId, proj.id));
    expect(memberRows).toHaveLength(0);
    const counterRows = await testDb.select().from(issueCounter).where(eq(issueCounter.projectId, proj.id));
    expect(counterRows).toHaveLength(0);
  });

  it("returns not_found for a project id that resolves to no row", async () => {
    const result = await deleteProject(crypto.randomUUID());

    expect(result).toEqual({ status: "not_found" });
  });

  it("decides an archive-then-delete race by the row lock, never on an earlier read", async () => {
    const proj = await insertProject({ status: "archived" });

    const [deleteResult] = await Promise.all([deleteProject(proj.id), setProjectStatus(proj.id, "active")]);

    const rows = await testDb.select().from(project).where(eq(project.id, proj.id));
    if (deleteResult.status === "deleted") {
      expect(rows).toHaveLength(0);
    } else {
      expect(deleteResult).toEqual({ status: "not_archived" });
      expect(rows).toHaveLength(1);
      expect(rows[0]?.status).toBe("active");
    }
  });

  it("leaves the deleted key immediately available to a new project", async () => {
    const proj = await insertProject({ status: "archived", key: "REUSE" });

    await deleteProject(proj.id);
    const [recreated] = await testDb
      .insert(project)
      .values({
        key: "REUSE",
        name: "New Project",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    expect(recreated?.key).toBe("REUSE");
  });
});