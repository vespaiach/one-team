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

function issueValues(
  overrides: Partial<typeof issue.$inferInsert> & { projectId: string; columnId: string; createdBy: string },
) {
  const now = new Date();
  return {
    number: 1,
    title: "Fix the header",
    sortOrder: "a0",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("UNIQUE (project_id, number) — the issue's address (FR-014, FR-017, SC-002)", () => {
  it("refuses a second issue with the same number in one project", async () => {
    const proj = await insertProject();
    const column = await insertColumn(proj.id);
    const creator = await insertUser();
    await testDb
      .insert(issue)
      .values(issueValues({ projectId: proj.id, columnId: column.id, createdBy: creator.id, number: 1 }));

    await expect(
      testDb
        .insert(issue)
        .values(issueValues({ projectId: proj.id, columnId: column.id, createdBy: creator.id, number: 1 })),
    ).rejects.toThrow();
  });

  it("allows the same number to be reused across two different projects", async () => {
    const first = await insertProject();
    const firstColumn = await insertColumn(first.id);
    const second = await insertProject();
    const secondColumn = await insertColumn(second.id);
    const creator = await insertUser();
    await testDb
      .insert(issue)
      .values(
        issueValues({ projectId: first.id, columnId: firstColumn.id, createdBy: creator.id, number: 1 }),
      );

    await expect(
      testDb
        .insert(issue)
        .values(
          issueValues({ projectId: second.id, columnId: secondColumn.id, createdBy: creator.id, number: 1 }),
        ),
    ).resolves.toBeDefined();
  });
});

describe("composite FOREIGN KEY (project_id, column_id) (FR-005, OT-INV-004)", () => {
  it("refuses a column that belongs to another project", async () => {
    const owningProject = await insertProject();
    const otherProject = await insertProject();
    const columnFromOtherProject = await insertColumn(otherProject.id);
    const creator = await insertUser();

    await expect(
      testDb.insert(issue).values(
        issueValues({
          projectId: owningProject.id,
          columnId: columnFromOtherProject.id,
          createdBy: creator.id,
          number: 1,
        }),
      ),
    ).rejects.toThrow();
  });

  it("accepts a column that belongs to the issue's own project", async () => {
    const proj = await insertProject();
    const column = await insertColumn(proj.id);
    const creator = await insertUser();

    await expect(
      testDb
        .insert(issue)
        .values(issueValues({ projectId: proj.id, columnId: column.id, createdBy: creator.id, number: 1 })),
    ).resolves.toBeDefined();
  });
});