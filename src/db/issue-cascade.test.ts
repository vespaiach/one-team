import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { boardColumn, issue, project, user } from "./schema";
import { testDb, truncateTestDatabase } from "./test-database";

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

async function insertColumn(projectId: string, overrides: Partial<typeof boardColumn.$inferInsert> = {}) {
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
      ...overrides,
    })
    .returning();
  if (!row) {
    throw new Error("insertColumn produced no row");
  }
  return row;
}

describe("project delete cascades to columns and issues in one statement (FR-005, research A-4)", () => {
  it("succeeds and removes both the columns and the issues that referenced them", async () => {
    const proj = await insertProject();
    const column = await insertColumn(proj.id);
    const creator = await insertUser();
    const now = new Date();
    await testDb.insert(issue).values({
      projectId: proj.id,
      number: 1,
      title: "Fix the header",
      columnId: column.id,
      createdBy: creator.id,
      sortOrder: "a0",
      createdAt: now,
      updatedAt: now,
    });

    await expect(testDb.delete(project).where(eq(project.id, proj.id))).resolves.toBeDefined();

    const remainingColumns = await testDb
      .select()
      .from(boardColumn)
      .where(eq(boardColumn.projectId, proj.id));
    expect(remainingColumns).toHaveLength(0);
    const remainingIssues = await testDb.select().from(issue).where(eq(issue.projectId, proj.id));
    expect(remainingIssues).toHaveLength(0);
  });
});