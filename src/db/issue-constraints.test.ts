import { uuidv7 } from "uuidv7";
import { beforeEach, describe, expect, it } from "vitest";
import { boardColumn, issue, project, user } from "./schema";
import { testDb, testSql, truncateTestDatabase } from "./test-database";

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

type Fixture = { projectId: string; columnId: string; createdBy: string };

async function fixture(): Promise<Fixture> {
  const proj = await insertProject();
  const column = await insertColumn(proj.id);
  const creator = await insertUser();
  return { projectId: proj.id, columnId: column.id, createdBy: creator.id };
}

function issueValues(fx: Fixture, overrides: Partial<typeof issue.$inferInsert> = {}) {
  const now = new Date();
  return {
    projectId: fx.projectId,
    number: 1,
    title: "Fix the header",
    columnId: fx.columnId,
    createdBy: fx.createdBy,
    sortOrder: "a0",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("issue CHECK bounds (FR-004, FR-008, SC-016, edge cases 19)", () => {
  describe("title length", () => {
    it("accepts a title at exactly 200 characters", async () => {
      const fx = await fixture();
      await expect(
        testDb.insert(issue).values(issueValues(fx, { title: "a".repeat(200) })),
      ).resolves.toBeDefined();
    });

    it("rejects a title over 200 characters", async () => {
      const fx = await fixture();
      await expect(
        testDb.insert(issue).values(issueValues(fx, { title: "a".repeat(201) })),
      ).rejects.toThrow();
    });
  });

  describe("description length", () => {
    it("accepts a description at exactly 10000 characters", async () => {
      const fx = await fixture();
      await expect(
        testDb.insert(issue).values(issueValues(fx, { description: "a".repeat(10000) })),
      ).resolves.toBeDefined();
    });

    it("rejects a description over 10000 characters", async () => {
      const fx = await fixture();
      await expect(
        testDb.insert(issue).values(issueValues(fx, { description: "a".repeat(10001) })),
      ).rejects.toThrow();
    });
  });

  describe("priority set", () => {
    it.each(["none", "low", "medium", "high", "urgent"])("accepts priority %s", async (priority) => {
      const fx = await fixture();
      await expect(testDb.insert(issue).values(issueValues(fx, { priority }))).resolves.toBeDefined();
    });

    it("rejects a priority outside the five values", async () => {
      const fx = await fixture();
      await expect(testDb.insert(issue).values(issueValues(fx, { priority: "critical" }))).rejects.toThrow();
    });
  });
});

describe("issue NOT NULL columns (FR-001, FR-005, FR-011, FR-013, FR-030, FR-040)", () => {
  async function rawIssueRow(overrides: Record<string, unknown> = {}) {
    const fx = await fixture();
    const now = new Date();
    return {
      id: uuidv7(),
      project_id: fx.projectId,
      number: 1,
      title: "Fix the header",
      column_id: fx.columnId,
      priority: "none",
      created_by: fx.createdBy,
      sort_order: "a0",
      created_at: now,
      updated_at: now,
      ...overrides,
    };
  }

  async function insertRaw(values: Record<string, unknown>) {
    return testSql`INSERT INTO issue ${testSql(values)}`;
  }

  it("rejects a null project_id", async () => {
    const row = await rawIssueRow({ project_id: null });
    await expect(insertRaw(row)).rejects.toThrow();
  });

  it("rejects a null number", async () => {
    const row = await rawIssueRow({ number: null });
    await expect(insertRaw(row)).rejects.toThrow();
  });

  it("rejects a null title", async () => {
    const row = await rawIssueRow({ title: null });
    await expect(insertRaw(row)).rejects.toThrow();
  });

  it("rejects a null column_id", async () => {
    const row = await rawIssueRow({ column_id: null });
    await expect(insertRaw(row)).rejects.toThrow();
  });

  it("rejects a null created_by", async () => {
    const row = await rawIssueRow({ created_by: null });
    await expect(insertRaw(row)).rejects.toThrow();
  });

  it("rejects a null sort_order", async () => {
    const row = await rawIssueRow({ sort_order: null });
    await expect(insertRaw(row)).rejects.toThrow();
  });
});