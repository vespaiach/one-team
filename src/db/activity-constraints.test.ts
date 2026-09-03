import { eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { beforeEach, describe, expect, it } from "vitest";
import { activity, boardColumn, comment, issue, project, user } from "./schema";
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

async function insertComment(
  authorId: string,
  target: { issueId: string } | { projectId: string },
  overrides: Partial<typeof comment.$inferInsert> = {},
) {
  const now = new Date();
  const [row] = await testDb
    .insert(comment)
    .values({
      authorId,
      body: "Looks good.",
      createdAt: now,
      updatedAt: now,
      ...target,
      ...overrides,
    })
    .returning();
  if (!row) {
    throw new Error("insertComment produced no row");
  }
  return row;
}

type Fixture = { userId: string; projectId: string; issueId: string };

async function fixture(): Promise<Fixture> {
  const actorRow = await insertUser();
  const projectRow = await insertProject();
  const columnRow = await insertColumn(projectRow.id);
  const issueRow = await insertIssue(projectRow.id, columnRow.id, actorRow.id);
  return { userId: actorRow.id, projectId: projectRow.id, issueId: issueRow.id };
}

function activityValues(fx: Fixture, overrides: Partial<typeof activity.$inferInsert> = {}) {
  const now = new Date();
  return {
    actorId: fx.userId,
    type: "created",
    issueId: fx.issueId,
    createdAt: now,
    ...overrides,
  };
}

describe("activity CHECK bounds — from_value and to_value (FR-002, FR-008)", () => {
  it("accepts a from_value at exactly 200 characters", async () => {
    const fx = await fixture();
    await expect(
      testDb
        .insert(activity)
        .values(activityValues(fx, { type: "field_changed", field: "name", fromValue: "a".repeat(200) })),
    ).resolves.toBeDefined();
  });

  it("rejects a from_value over 200 characters", async () => {
    const fx = await fixture();
    await expect(
      testDb
        .insert(activity)
        .values(activityValues(fx, { type: "field_changed", field: "name", fromValue: "a".repeat(201) })),
    ).rejects.toThrow();
  });

  it("accepts a to_value at exactly 200 characters", async () => {
    const fx = await fixture();
    await expect(
      testDb
        .insert(activity)
        .values(activityValues(fx, { type: "field_changed", field: "name", toValue: "a".repeat(200) })),
    ).resolves.toBeDefined();
  });

  it("rejects a to_value over 200 characters", async () => {
    const fx = await fixture();
    await expect(
      testDb
        .insert(activity)
        .values(activityValues(fx, { type: "field_changed", field: "name", toValue: "a".repeat(201) })),
    ).rejects.toThrow();
  });
});

describe("activity.type CHECK — exactly the seven values (FR-004)", () => {
  it.each([
    "created",
    "member_added",
    "member_removed",
    "archived",
    "reopened",
  ])("accepts type %s", async (type) => {
    const fx = await fixture();
    await expect(testDb.insert(activity).values(activityValues(fx, { type }))).resolves.toBeDefined();
  });

  it("accepts type field_changed", async () => {
    const fx = await fixture();
    await expect(
      testDb.insert(activity).values(activityValues(fx, { type: "field_changed", field: "name" })),
    ).resolves.toBeDefined();
  });

  it("accepts type comment, with a comment_id", async () => {
    const fx = await fixture();
    const commentRow = await insertComment(fx.userId, { issueId: fx.issueId });
    await expect(
      testDb.insert(activity).values(activityValues(fx, { type: "comment", commentId: commentRow.id })),
    ).resolves.toBeDefined();
  });

  it("rejects an eighth value outside the seven", async () => {
    const fx = await fixture();
    await expect(
      testDb.insert(activity).values(activityValues(fx, { type: "label_added" })),
    ).rejects.toThrow();
  });
});

describe("activity target CHECK — exactly one of issue_id or project_id (OT-INV-010)", () => {
  it("rejects both issue_id and project_id set", async () => {
    const fx = await fixture();
    await expect(
      testDb.insert(activity).values(activityValues(fx, { issueId: fx.issueId, projectId: fx.projectId })),
    ).rejects.toThrow();
  });

  it("rejects both issue_id and project_id null", async () => {
    const fx = await fixture();
    await expect(
      testDb.insert(activity).values(activityValues(fx, { issueId: null, projectId: null })),
    ).rejects.toThrow();
  });
});

describe("activity comment_id CHECK — set if and only if type = 'comment' (research A-4)", () => {
  it("rejects type comment with no comment_id", async () => {
    const fx = await fixture();
    await expect(
      testDb.insert(activity).values(activityValues(fx, { type: "comment", commentId: null })),
    ).rejects.toThrow();
  });

  it("rejects a comment_id set on a non-comment type", async () => {
    const fx = await fixture();
    const commentRow = await insertComment(fx.userId, { issueId: fx.issueId });
    await expect(
      testDb.insert(activity).values(activityValues(fx, { type: "created", commentId: commentRow.id })),
    ).rejects.toThrow();
  });
});

describe("activity NOT NULL columns (FR-002, FR-005)", () => {
  async function rawActivityRow(fx: Fixture, overrides: Record<string, unknown> = {}) {
    const now = new Date();
    return {
      id: uuidv7(),
      actor_id: fx.userId,
      type: "created",
      issue_id: fx.issueId,
      project_id: null,
      field: null,
      from_value: null,
      to_value: null,
      comment_id: null,
      created_at: now,
      ...overrides,
    };
  }

  async function insertRaw(values: Record<string, unknown>) {
    return testSql`INSERT INTO activity ${testSql(values)}`;
  }

  it("rejects a null actor_id", async () => {
    const fx = await fixture();
    const row = await rawActivityRow(fx, { actor_id: null });
    await expect(insertRaw(row)).rejects.toThrow();
  });

  it("rejects a null type", async () => {
    const fx = await fixture();
    const row = await rawActivityRow(fx, { type: null });
    await expect(insertRaw(row)).rejects.toThrow();
  });

  it("rejects a null created_at", async () => {
    const fx = await fixture();
    const row = await rawActivityRow(fx, { created_at: null });
    await expect(insertRaw(row)).rejects.toThrow();
  });
});

describe("activity cascade on delete of its parent (FR-002, OT-DATA-011)", () => {
  it("removes the activity row when its parent issue is deleted", async () => {
    const fx = await fixture();
    const [row] = await testDb.insert(activity).values(activityValues(fx)).returning();
    if (!row) {
      throw new Error("setup: activity not inserted");
    }

    await testDb.delete(issue).where(eq(issue.id, fx.issueId));

    const remaining = await testDb.select().from(activity).where(eq(activity.id, row.id));
    expect(remaining).toHaveLength(0);
  });

  it("removes the activity row when its parent project is deleted", async () => {
    const actorRow = await insertUser();
    const projectRow = await insertProject();
    const [row] = await testDb
      .insert(activity)
      .values({ actorId: actorRow.id, type: "created", projectId: projectRow.id, createdAt: new Date() })
      .returning();
    if (!row) {
      throw new Error("setup: activity not inserted");
    }

    await testDb.delete(project).where(eq(project.id, projectRow.id));

    const remaining = await testDb.select().from(activity).where(eq(activity.id, row.id));
    expect(remaining).toHaveLength(0);
  });

  it("removes the activity row when its referenced comment is deleted", async () => {
    const fx = await fixture();
    const commentRow = await insertComment(fx.userId, { issueId: fx.issueId });
    const [row] = await testDb
      .insert(activity)
      .values(activityValues(fx, { type: "comment", commentId: commentRow.id }))
      .returning();
    if (!row) {
      throw new Error("setup: activity not inserted");
    }

    await testDb.delete(comment).where(eq(comment.id, commentRow.id));

    const remaining = await testDb.select().from(activity).where(eq(activity.id, row.id));
    expect(remaining).toHaveLength(0);
  });
});