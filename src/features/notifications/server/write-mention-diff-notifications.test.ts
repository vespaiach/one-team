import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eq, TransactionRollbackError } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { boardColumn, comment, issue, notification, project, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { writeMentionDiffNotifications } from "./write-notifications";

const WRITER_SOURCE = join(
  process.cwd(),
  "src",
  "features",
  "notifications",
  "server",
  "write-notifications.ts",
);

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

async function insertProject() {
  const now = new Date();
  const [row] = await testDb
    .insert(project)
    .values({
      key: `P${crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      name: "Website Redesign",
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!row) {
    throw new Error("insertProject produced no row");
  }
  return row;
}

async function insertIssueRow(projectId: string, createdBy: string, assigneeId: string | null) {
  const now = new Date();
  const [column] = await testDb
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
  if (!column) {
    throw new Error("insertColumn produced no row");
  }
  const [row] = await testDb
    .insert(issue)
    .values({
      projectId,
      number: 1,
      title: "Fix the header",
      columnId: column.id,
      createdBy,
      assigneeId,
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

async function insertComment(authorId: string, target: { issueId: string } | { projectId: string }) {
  const now = new Date();
  const [row] = await testDb
    .insert(comment)
    .values({ authorId, body: "Looks good.", ...target, createdAt: now, updatedAt: now })
    .returning();
  if (!row) {
    throw new Error("insertComment produced no row");
  }
  return row;
}

async function insertNotification(values: typeof notification.$inferInsert) {
  const [row] = await testDb.insert(notification).values(values).returning();
  if (!row) {
    throw new Error("insertNotification produced no row");
  }
  return row;
}

async function census() {
  const rows = await testDb.select().from(notification);
  return rows.sort((left, right) => left.id.localeCompare(right.id));
}

function mention(id: string) {
  return `@[${id}]`;
}

describe("writeMentionDiffNotifications — the diff (FR-053)", () => {
  it("writes one mention row for each user the next body newly names", async () => {
    const proj = await insertProject();
    const author = await insertUser();
    const ana = await insertUser({ firstName: "Ana" });
    const ben = await insertUser({ firstName: "Ben" });
    const issueRow = await insertIssueRow(proj.id, author.id, null);
    const commentRow = await insertComment(author.id, { issueId: issueRow.id });

    const written = await testDb.transaction((tx) =>
      writeMentionDiffNotifications(tx, {
        commentId: commentRow.id,
        target: { issueId: issueRow.id },
        actorId: author.id,
        previousBody: `Hello ${mention(ana.id)}`,
        nextBody: `Hello ${mention(ana.id)} and ${mention(ben.id)}`,
      }),
    );

    expect(written).toHaveLength(1);

    const rows = await census();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId: ben.id,
      actorId: author.id,
      type: "mention",
      issueId: issueRow.id,
      projectId: null,
      commentId: commentRow.id,
      sendAttempts: 0,
      readAt: null,
      emailedAt: null,
    });
  });

  it("writes nothing when the next body names nobody the previous body did not", async () => {
    const proj = await insertProject();
    const author = await insertUser();
    const ana = await insertUser({ firstName: "Ana" });
    const issueRow = await insertIssueRow(proj.id, author.id, null);
    const commentRow = await insertComment(author.id, { issueId: issueRow.id });

    const before = await census();
    const written = await testDb.transaction((tx) =>
      writeMentionDiffNotifications(tx, {
        commentId: commentRow.id,
        target: { issueId: issueRow.id },
        actorId: author.id,
        previousBody: `Hello ${mention(ana.id)}`,
        nextBody: `Hello again ${mention(ana.id)}, with more words.`,
      }),
    );

    expect(written).toEqual([]);
    expect(await census()).toEqual(before);
  });

  it("deduplicates a newly named user repeated twice into one row", async () => {
    const proj = await insertProject();
    const author = await insertUser();
    const ben = await insertUser({ firstName: "Ben" });
    const issueRow = await insertIssueRow(proj.id, author.id, null);
    const commentRow = await insertComment(author.id, { issueId: issueRow.id });

    const written = await testDb.transaction((tx) =>
      writeMentionDiffNotifications(tx, {
        commentId: commentRow.id,
        target: { issueId: issueRow.id },
        actorId: author.id,
        previousBody: "Nobody yet.",
        nextBody: `${mention(ben.id)} and again ${mention(ben.id)}`,
      }),
    );

    expect(written).toHaveLength(1);
    const rows = await census();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.userId).toBe(ben.id);
  });

  it("ignores a token naming no user and still writes the rows that name one", async () => {
    const proj = await insertProject();
    const author = await insertUser();
    const ben = await insertUser({ firstName: "Ben" });
    const issueRow = await insertIssueRow(proj.id, author.id, null);
    const commentRow = await insertComment(author.id, { issueId: issueRow.id });

    const written = await testDb.transaction((tx) =>
      writeMentionDiffNotifications(tx, {
        commentId: commentRow.id,
        target: { issueId: issueRow.id },
        actorId: author.id,
        previousBody: "Nobody yet.",
        nextBody: `${mention(crypto.randomUUID())} and ${mention(ben.id)}`,
      }),
    );

    expect(written).toHaveLength(1);
    const rows = await census();
    expect(rows.map((row) => row.userId)).toEqual([ben.id]);
  });

  it("carries the project target of a project comment, leaving issue_id null", async () => {
    const proj = await insertProject();
    const author = await insertUser();
    const ben = await insertUser({ firstName: "Ben" });
    const commentRow = await insertComment(author.id, { projectId: proj.id });

    await testDb.transaction((tx) =>
      writeMentionDiffNotifications(tx, {
        commentId: commentRow.id,
        target: { projectId: proj.id },
        actorId: author.id,
        previousBody: "Nobody yet.",
        nextBody: `Ping ${mention(ben.id)}`,
      }),
    );

    const rows = await census();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId: ben.id,
      type: "mention",
      issueId: null,
      projectId: proj.id,
      commentId: commentRow.id,
    });
  });
});

describe("writeMentionDiffNotifications — an edit writes no comment-type row (FR-054, SC-009)", () => {
  it("writes one mention row and nothing for the issue's assignee or creator", async () => {
    const proj = await insertProject();
    const author = await insertUser();
    const creator = await insertUser({ firstName: "Cass" });
    const assignee = await insertUser({ firstName: "Dev" });
    const ben = await insertUser({ firstName: "Ben" });
    const issueRow = await insertIssueRow(proj.id, creator.id, assignee.id);
    const commentRow = await insertComment(author.id, { issueId: issueRow.id });

    await testDb.transaction((tx) =>
      writeMentionDiffNotifications(tx, {
        commentId: commentRow.id,
        target: { issueId: issueRow.id },
        actorId: author.id,
        previousBody: "Nobody yet.",
        nextBody: `Ping ${mention(ben.id)}`,
      }),
    );

    const rows = await census();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.type).toBe("mention");
    expect(rows[0]?.userId).toBe(ben.id);
  });

  it("takes no type from its caller — the input carries none", async () => {
    const source = readFileSync(WRITER_SOURCE, "utf8");
    expect(source).toContain("WriteMentionDiffNotificationsInput");
    const [, diffInput] = source.split("export type WriteMentionDiffNotificationsInput = {");
    const [inputFields] = (diffInput ?? "").split("};");
    expect(inputFields).not.toContain("type");
  });
});

describe("writeMentionDiffNotifications — nobody holds a second row (FR-055, SC-006)", () => {
  it("writes no second row for a newly named user who already holds a mention row for that comment", async () => {
    const proj = await insertProject();
    const author = await insertUser();
    const ana = await insertUser({ firstName: "Ana" });
    const issueRow = await insertIssueRow(proj.id, author.id, null);
    const commentRow = await insertComment(author.id, { issueId: issueRow.id });
    const now = new Date();
    await insertNotification({
      userId: ana.id,
      actorId: author.id,
      type: "mention",
      issueId: issueRow.id,
      commentId: commentRow.id,
      createdAt: now,
      updatedAt: now,
    });

    const before = await census();
    const written = await testDb.transaction((tx) =>
      writeMentionDiffNotifications(tx, {
        commentId: commentRow.id,
        target: { issueId: issueRow.id },
        actorId: author.id,
        previousBody: "Nobody yet.",
        nextBody: `Ping ${mention(ana.id)}`,
      }),
    );

    expect(written).toEqual([]);
    expect(await census()).toEqual(before);
  });

  it("writes no second row for a newly named user who already holds a comment row for that comment", async () => {
    const proj = await insertProject();
    const author = await insertUser();
    const listener = await insertUser({ firstName: "Cass" });
    const issueRow = await insertIssueRow(proj.id, author.id, null);
    const commentRow = await insertComment(author.id, { issueId: issueRow.id });
    const now = new Date();
    await insertNotification({
      userId: listener.id,
      actorId: author.id,
      type: "comment",
      issueId: issueRow.id,
      commentId: commentRow.id,
      createdAt: now,
      updatedAt: now,
    });

    const before = await census();
    const written = await testDb.transaction((tx) =>
      writeMentionDiffNotifications(tx, {
        commentId: commentRow.id,
        target: { issueId: issueRow.id },
        actorId: author.id,
        previousBody: "Nobody yet.",
        nextBody: `Ping ${mention(listener.id)}`,
      }),
    );

    expect(written).toEqual([]);
    const after = await census();
    expect(after).toEqual(before);
    expect(after[0]?.type).toBe("comment");
  });
});

describe("writeMentionDiffNotifications — nothing is withdrawn (FR-056, FR-032)", () => {
  it("leaves the row a dropped mention already produced exactly as it was", async () => {
    const proj = await insertProject();
    const author = await insertUser();
    const ana = await insertUser({ firstName: "Ana" });
    const issueRow = await insertIssueRow(proj.id, author.id, null);
    const commentRow = await insertComment(author.id, { issueId: issueRow.id });
    const stamped = new Date(Date.now() - 60_000);
    await insertNotification({
      userId: ana.id,
      actorId: author.id,
      type: "mention",
      issueId: issueRow.id,
      commentId: commentRow.id,
      emailedAt: stamped,
      sendAttempts: 1,
      createdAt: stamped,
      updatedAt: stamped,
    });

    const before = await census();
    const written = await testDb.transaction((tx) =>
      writeMentionDiffNotifications(tx, {
        commentId: commentRow.id,
        target: { issueId: issueRow.id },
        actorId: author.id,
        previousBody: `Ping ${mention(ana.id)}`,
        nextBody: "Never mind.",
      }),
    );

    expect(written).toEqual([]);
    expect(await census()).toEqual(before);
  });

  it("issues no delete and no update — the writer only inserts", () => {
    const source = readFileSync(WRITER_SOURCE, "utf8");
    expect(source).toContain("export async function writeMentionDiffNotifications");
    expect(source).not.toContain(".delete(");
    expect(source).not.toContain(".update(");
  });
});

describe("writeMentionDiffNotifications — who is eligible (FR-038, FR-039, SC-004, SC-005)", () => {
  it("writes nothing for the actor naming themselves", async () => {
    const proj = await insertProject();
    const author = await insertUser();
    const issueRow = await insertIssueRow(proj.id, author.id, null);
    const commentRow = await insertComment(author.id, { issueId: issueRow.id });

    const written = await testDb.transaction((tx) =>
      writeMentionDiffNotifications(tx, {
        commentId: commentRow.id,
        target: { issueId: issueRow.id },
        actorId: author.id,
        previousBody: "Nobody yet.",
        nextBody: `Note to self ${mention(author.id)}`,
      }),
    );

    expect(written).toEqual([]);
    expect(await census()).toEqual([]);
  });

  it("writes nothing for a newly named deactivated user, while the live one still gets a row", async () => {
    const proj = await insertProject();
    const author = await insertUser();
    const gone = await insertUser({ firstName: "Gone", deactivatedAt: new Date() });
    const ben = await insertUser({ firstName: "Ben" });
    const issueRow = await insertIssueRow(proj.id, author.id, null);
    const commentRow = await insertComment(author.id, { issueId: issueRow.id });

    const written = await testDb.transaction((tx) =>
      writeMentionDiffNotifications(tx, {
        commentId: commentRow.id,
        target: { issueId: issueRow.id },
        actorId: author.id,
        previousBody: "Nobody yet.",
        nextBody: `${mention(gone.id)} and ${mention(ben.id)}`,
      }),
    );

    expect(written).toHaveLength(1);
    const rows = await census();
    expect(rows.map((row) => row.userId)).toEqual([ben.id]);
  });
});

describe("writeMentionDiffNotifications — every statement runs on the caller's transaction (FR-041, SC-010)", () => {
  it("writes nothing that survives when the caller's transaction rolls back", async () => {
    const proj = await insertProject();
    const author = await insertUser();
    const ben = await insertUser({ firstName: "Ben" });
    const issueRow = await insertIssueRow(proj.id, author.id, null);
    const commentRow = await insertComment(author.id, { issueId: issueRow.id });

    await expect(
      testDb.transaction(async (tx) => {
        await writeMentionDiffNotifications(tx, {
          commentId: commentRow.id,
          target: { issueId: issueRow.id },
          actorId: author.id,
          previousBody: "Nobody yet.",
          nextBody: `Ping ${mention(ben.id)}`,
        });
        tx.rollback();
      }),
    ).rejects.toBeInstanceOf(TransactionRollbackError);

    expect(await census()).toEqual([]);
  });

  it("reads liveness through the caller's transaction, seeing a deactivation that has not committed", async () => {
    const proj = await insertProject();
    const author = await insertUser();
    const ben = await insertUser({ firstName: "Ben" });
    const issueRow = await insertIssueRow(proj.id, author.id, null);
    const commentRow = await insertComment(author.id, { issueId: issueRow.id });

    let written: string[] = [];
    await expect(
      testDb.transaction(async (tx) => {
        await tx.update(user).set({ deactivatedAt: new Date() }).where(eq(user.id, ben.id));
        written = await writeMentionDiffNotifications(tx, {
          commentId: commentRow.id,
          target: { issueId: issueRow.id },
          actorId: author.id,
          previousBody: "Nobody yet.",
          nextBody: `Ping ${mention(ben.id)}`,
        });
        tx.rollback();
      }),
    ).rejects.toBeInstanceOf(TransactionRollbackError);

    expect(written).toEqual([]);
  });
});