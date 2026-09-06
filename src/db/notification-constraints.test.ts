import postgres from "postgres";
import { uuidv7 } from "uuidv7";
import { beforeEach, describe, expect, it } from "vitest";
import { boardColumn, comment, issue, notification, project, user } from "./schema";
import { testDb, truncateTestDatabase } from "./test-database";

beforeEach(async () => {
  await truncateTestDatabase();
});

function requireTestDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error("TEST_DATABASE_URL is not set");
  }
  return url;
}

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

type Fixture = {
  recipientId: string;
  actorId: string;
  projectId: string;
  issueId: string;
  commentId: string;
  otherCommentId: string;
};

async function fixture(): Promise<Fixture> {
  const now = new Date();
  const actor = await insertUser();
  const recipient = await insertUser({ firstName: "Grace", lastName: "Hopper" });
  const [projectRow] = await testDb
    .insert(project)
    .values({
      key: `P${crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      name: "Website Redesign",
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!projectRow) {
    throw new Error("fixture produced no project");
  }
  const [columnRow] = await testDb
    .insert(boardColumn)
    .values({
      projectId: projectRow.id,
      name: "Backlog",
      kind: "open",
      sortOrder: "a0",
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!columnRow) {
    throw new Error("fixture produced no column");
  }
  const [issueRow] = await testDb
    .insert(issue)
    .values({
      projectId: projectRow.id,
      number: 1,
      title: "Fix the header",
      columnId: columnRow.id,
      createdBy: actor.id,
      sortOrder: "a0",
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!issueRow) {
    throw new Error("fixture produced no issue");
  }
  const commentRows = await testDb
    .insert(comment)
    .values([
      { authorId: actor.id, body: "Looks good.", issueId: issueRow.id, createdAt: now, updatedAt: now },
      { authorId: actor.id, body: "One more thing.", issueId: issueRow.id, createdAt: now, updatedAt: now },
    ])
    .returning();
  const [commentRow, otherCommentRow] = commentRows;
  if (!commentRow || !otherCommentRow) {
    throw new Error("fixture produced no comments");
  }
  return {
    recipientId: recipient.id,
    actorId: actor.id,
    projectId: projectRow.id,
    issueId: issueRow.id,
    commentId: commentRow.id,
    otherCommentId: otherCommentRow.id,
  };
}

function insertNotification(fx: Fixture, overrides: Partial<typeof notification.$inferInsert> = {}) {
  return testDb.insert(notification).values(notificationValues(fx, overrides));
}

function notificationValues(fx: Fixture, overrides: Partial<typeof notification.$inferInsert> = {}) {
  const now = new Date();
  return {
    userId: fx.recipientId,
    actorId: fx.actorId,
    type: "assignment",
    issueId: fx.issueId,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("notification_type_valid — exactly the three types (FR-002)", () => {
  it("accepts type assignment with no comment", async () => {
    const fx = await fixture();
    await expect(insertNotification(fx)).resolves.toBeDefined();
  });

  it.each(["mention", "comment"])("accepts type %s carrying a comment", async (type) => {
    const fx = await fixture();
    await expect(insertNotification(fx, { type, commentId: fx.commentId })).resolves.toBeDefined();
  });

  it("rejects a fourth value outside the three", async () => {
    const fx = await fixture();
    await expect(insertNotification(fx, { type: "label_added" })).rejects.toThrow();
  });
});

describe("notification_target_exactly_one — one of issue_id or project_id (FR-003, OT-INV-010)", () => {
  it("rejects both issue_id and project_id set", async () => {
    const fx = await fixture();
    await expect(insertNotification(fx, { issueId: fx.issueId, projectId: fx.projectId })).rejects.toThrow();
  });

  it("rejects both issue_id and project_id null", async () => {
    const fx = await fixture();
    await expect(insertNotification(fx, { issueId: null, projectId: null })).rejects.toThrow();
  });
});

describe("notification_actor_not_recipient — the backstop (FR-004)", () => {
  it("rejects a row whose recipient is its own actor", async () => {
    const fx = await fixture();
    await expect(insertNotification(fx, { userId: fx.actorId, actorId: fx.actorId })).rejects.toThrow();
  });
});

describe("notification_comment_id_matches_type — set unless the type is assignment (FR-005)", () => {
  it("rejects an assignment carrying a comment_id", async () => {
    const fx = await fixture();
    await expect(insertNotification(fx, { type: "assignment", commentId: fx.commentId })).rejects.toThrow();
  });

  it.each(["mention", "comment"])("rejects a %s with no comment_id", async (type) => {
    const fx = await fixture();
    await expect(insertNotification(fx, { type, commentId: null })).rejects.toThrow();
  });
});

describe("notification_send_attempts_range — zero to four (FR-007, FR-067)", () => {
  it.each([0, 4])("accepts %i attempts", async (sendAttempts) => {
    const fx = await fixture();
    await expect(insertNotification(fx, { sendAttempts })).resolves.toBeDefined();
  });

  it.each([-1, 5])("rejects %i attempts", async (sendAttempts) => {
    const fx = await fixture();
    await expect(insertNotification(fx, { sendAttempts })).rejects.toThrow();
  });
});

describe("one notification per person per comment (FR-006, SC-006, research A-4, F-3)", () => {
  it("rejects a second row for the same person and comment", async () => {
    const fx = await fixture();
    await insertNotification(fx, { type: "mention", commentId: fx.commentId });

    await expect(insertNotification(fx, { type: "comment", commentId: fx.commentId })).rejects.toThrow();
  });

  it("permits the same person a row on a different comment", async () => {
    const fx = await fixture();
    await insertNotification(fx, { type: "mention", commentId: fx.commentId });

    await expect(
      insertNotification(fx, { type: "mention", commentId: fx.otherCommentId }),
    ).resolves.toBeDefined();
  });

  it("permits many rows for one person with a null comment_id", async () => {
    const fx = await fixture();
    await insertNotification(fx);
    await insertNotification(fx);
    await insertNotification(fx);

    const rows = await testDb.select().from(notification);
    expect(rows).toHaveLength(3);
  });

  it("admits exactly one of two concurrent transactions writing the same pair", async () => {
    const fx = await fixture();
    const first = postgres(requireTestDatabaseUrl(), { max: 1 });
    const second = postgres(requireTestDatabaseUrl(), { max: 1 });

    try {
      const now = new Date();
      const write = (client: typeof first, type: string) =>
        client.begin(
          (tx) => tx`
            INSERT INTO notification
              (id, user_id, actor_id, type, issue_id, comment_id, send_attempts, created_at, updated_at)
            VALUES
              (${uuidv7()}, ${fx.recipientId}, ${fx.actorId}, ${type}, ${fx.issueId}, ${fx.commentId},
               0, ${now}, ${now})
          `,
        );

      const outcomes = await Promise.allSettled([write(first, "mention"), write(second, "comment")]);

      expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
      expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);
      const rows = await testDb.select().from(notification);
      expect(rows).toHaveLength(1);
    } finally {
      await first.end();
      await second.end();
    }
  });
});