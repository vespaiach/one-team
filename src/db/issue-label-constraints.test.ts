import { eq } from "drizzle-orm";
import postgres from "postgres";
import { beforeEach, describe, expect, it } from "vitest";
import { boardColumn, issue, issueLabel, label, project, user } from "./schema";
import { testDb, truncateTestDatabase } from "./test-database";

function requireTestDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error("TEST_DATABASE_URL is not set");
  }
  return url;
}

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

async function insertProjectWithColumn() {
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
  return { proj, column };
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

async function insertLabel(overrides: Partial<typeof label.$inferInsert> = {}) {
  const now = new Date();
  const [row] = await testDb
    .insert(label)
    .values({
      name: `Bug-${crypto.randomUUID()}`,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    })
    .returning();
  if (!row) {
    throw new Error("insertLabel produced no row");
  }
  return row;
}

async function fixture() {
  const { proj, column } = await insertProjectWithColumn();
  const creator = await insertUser();
  const created = await insertIssue(proj.id, column.id, creator.id);
  const createdLabel = await insertLabel();
  return { issueId: created.id, labelId: createdLabel.id };
}

describe("issue_label composite primary key dedup (FR-012, FR-022, data-model.md §2)", () => {
  it("refuses a duplicate (issue_id, label_id) pair", async () => {
    const { issueId, labelId } = await fixture();
    await testDb.insert(issueLabel).values({ issueId, labelId });

    await expect(testDb.insert(issueLabel).values({ issueId, labelId })).rejects.toThrow();
  });
});

describe("issue_label cascades on both foreign keys (FR-012, FR-022, data-model.md §2, §4)", () => {
  it("removes issue_label rows when the referenced issue is deleted, visible from a second connection", async () => {
    const { issueId, labelId } = await fixture();
    await testDb.insert(issueLabel).values({ issueId, labelId });

    await testDb.delete(issue).where(eq(issue.id, issueId));

    const secondConnection = postgres(requireTestDatabaseUrl(), { max: 1 });
    try {
      const rows = await secondConnection`
        SELECT issue_id FROM issue_label WHERE label_id = ${labelId}
      `;
      expect(rows).toHaveLength(0);
    } finally {
      await secondConnection.end();
    }
  });

  it("removes issue_label rows when the referenced label is deleted, visible from a second connection", async () => {
    const { issueId, labelId } = await fixture();
    await testDb.insert(issueLabel).values({ issueId, labelId });

    await testDb.delete(label).where(eq(label.id, labelId));

    const secondConnection = postgres(requireTestDatabaseUrl(), { max: 1 });
    try {
      const rows = await secondConnection`
        SELECT label_id FROM issue_label WHERE issue_id = ${issueId}
      `;
      expect(rows).toHaveLength(0);
    } finally {
      await secondConnection.end();
    }
  });
});