import { eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { beforeEach, describe, expect, it } from "vitest";
import { boardColumn, comment, issue, project, user } from "./schema";
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

async function insertIssue(
  projectId: string,
  columnId: string,
  createdBy: string,
  overrides: Partial<typeof issue.$inferInsert> = {},
) {
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
      ...overrides,
    })
    .returning();
  if (!row) {
    throw new Error("insertIssue produced no row");
  }
  return row;
}

type Fixture = { userId: string; projectId: string; issueId: string };

async function fixture(): Promise<Fixture> {
  const authorRow = await insertUser();
  const projectRow = await insertProject();
  const columnRow = await insertColumn(projectRow.id);
  const issueRow = await insertIssue(projectRow.id, columnRow.id, authorRow.id);
  return { userId: authorRow.id, projectId: projectRow.id, issueId: issueRow.id };
}

function commentValues(fx: Fixture, overrides: Partial<typeof comment.$inferInsert> = {}) {
  const now = new Date();
  return {
    authorId: fx.userId,
    body: "Looks good.",
    issueId: fx.issueId,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("comment CHECK bounds (FR-001, FR-010, OT-DATA-016)", () => {
  it("accepts a body at exactly 10000 characters", async () => {
    const fx = await fixture();
    await expect(
      testDb.insert(comment).values(commentValues(fx, { body: "a".repeat(10000) })),
    ).resolves.toBeDefined();
  });

  it("rejects a body over 10000 characters", async () => {
    const fx = await fixture();
    await expect(
      testDb.insert(comment).values(commentValues(fx, { body: "a".repeat(10001) })),
    ).rejects.toThrow();
  });
});

describe("comment NOT NULL columns (FR-001, FR-005)", () => {
  async function rawCommentRow(fx: Fixture, overrides: Record<string, unknown> = {}) {
    const now = new Date();
    return {
      id: uuidv7(),
      author_id: fx.userId,
      body: "Looks good.",
      issue_id: fx.issueId,
      project_id: null,
      created_at: now,
      updated_at: now,
      ...overrides,
    };
  }

  async function insertRaw(values: Record<string, unknown>) {
    return testSql`INSERT INTO comment ${testSql(values)}`;
  }

  it("rejects a null author_id", async () => {
    const fx = await fixture();
    const row = await rawCommentRow(fx, { author_id: null });
    await expect(insertRaw(row)).rejects.toThrow();
  });

  it("rejects a null body", async () => {
    const fx = await fixture();
    const row = await rawCommentRow(fx, { body: null });
    await expect(insertRaw(row)).rejects.toThrow();
  });

  it("rejects a null created_at", async () => {
    const fx = await fixture();
    const row = await rawCommentRow(fx, { created_at: null });
    await expect(insertRaw(row)).rejects.toThrow();
  });

  it("rejects a null updated_at", async () => {
    const fx = await fixture();
    const row = await rawCommentRow(fx, { updated_at: null });
    await expect(insertRaw(row)).rejects.toThrow();
  });
});

describe("comment target CHECK — exactly one of issue_id or project_id (OT-INV-010)", () => {
  it("rejects both issue_id and project_id set", async () => {
    const fx = await fixture();
    await expect(
      testDb.insert(comment).values(commentValues(fx, { issueId: fx.issueId, projectId: fx.projectId })),
    ).rejects.toThrow();
  });

  it("rejects both issue_id and project_id null", async () => {
    const fx = await fixture();
    await expect(
      testDb.insert(comment).values(commentValues(fx, { issueId: null, projectId: null })),
    ).rejects.toThrow();
  });
});

describe("comment cascade on delete of its parent (FR-001, OT-DATA-011)", () => {
  it("removes the comment when its parent issue is deleted", async () => {
    const fx = await fixture();
    const [row] = await testDb.insert(comment).values(commentValues(fx)).returning();
    if (!row) {
      throw new Error("setup: comment not inserted");
    }

    await testDb.delete(issue).where(eq(issue.id, fx.issueId));

    const remaining = await testDb.select().from(comment).where(eq(comment.id, row.id));
    expect(remaining).toHaveLength(0);
  });

  it("removes the comment when its parent project is deleted", async () => {
    const authorRow = await insertUser();
    const projectRow = await insertProject();
    const [row] = await testDb
      .insert(comment)
      .values({
        authorId: authorRow.id,
        body: "Looks good.",
        projectId: projectRow.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    if (!row) {
      throw new Error("setup: comment not inserted");
    }

    await testDb.delete(project).where(eq(project.id, projectRow.id));

    const remaining = await testDb.select().from(comment).where(eq(comment.id, row.id));
    expect(remaining).toHaveLength(0);
  });
});