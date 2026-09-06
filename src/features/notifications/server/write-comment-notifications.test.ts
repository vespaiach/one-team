import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { boardColumn, comment, issue, notification, project, projectMember, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { writeCommentNotifications } from "./write-notifications";

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

async function insertIssueRow(
  projectId: string,
  createdBy: string,
  assigneeId: string | null,
): Promise<typeof issue.$inferSelect> {
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

async function addMember(projectId: string, userId: string) {
  const now = new Date();
  await testDb.insert(projectMember).values({ projectId, userId, createdAt: now, updatedAt: now });
}

async function census() {
  return testDb.select().from(notification);
}

describe("writeCommentNotifications — the mention set (FR-043, FR-044, FR-046)", () => {
  it("writes one mention row per distinct id named in the body, deduplicating a repeated token", async () => {
    const proj = await insertProject();
    const actor = await insertUser();
    const named = await insertUser();
    const issueRow = await insertIssueRow(proj.id, actor.id, null);
    const commentRow = await insertComment(actor.id, { issueId: issueRow.id });

    await testDb.transaction((tx) =>
      writeCommentNotifications(tx, {
        commentId: commentRow.id,
        target: { issueId: issueRow.id },
        actorId: actor.id,
        body: `@[${named.id}] and again @[${named.id}]`,
      }),
    );

    const rows = await census();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId: named.id,
      actorId: actor.id,
      type: "mention",
      issueId: issueRow.id,
      projectId: null,
      commentId: commentRow.id,
      sendAttempts: 0,
    });
  });

  it("writes nothing for a token naming no user and does not stop the rest of the set", async () => {
    const proj = await insertProject();
    const actor = await insertUser();
    const named = await insertUser();
    const issueRow = await insertIssueRow(proj.id, actor.id, null);
    const commentRow = await insertComment(actor.id, { issueId: issueRow.id });

    await testDb.transaction((tx) =>
      writeCommentNotifications(tx, {
        commentId: commentRow.id,
        target: { issueId: issueRow.id },
        actorId: actor.id,
        body: `@[${crypto.randomUUID()}] @[${named.id}]`,
      }),
    );

    const rows = await census();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.userId).toBe(named.id);
  });

  it("removes the actor and every deactivated user from the mention set", async () => {
    const proj = await insertProject();
    const actor = await insertUser();
    const gone = await insertUser({ deactivatedAt: new Date() });
    const issueRow = await insertIssueRow(proj.id, actor.id, null);
    const commentRow = await insertComment(actor.id, { issueId: issueRow.id });
    const before = await census();

    const written = await testDb.transaction((tx) =>
      writeCommentNotifications(tx, {
        commentId: commentRow.id,
        target: { issueId: issueRow.id },
        actorId: actor.id,
        body: `@[${actor.id}] @[${gone.id}]`,
      }),
    );

    expect(written).toEqual([]);
    expect(await census()).toEqual(before);
  });
});

describe("writeCommentNotifications — the issue comment set (FR-047, FR-049)", () => {
  it("writes a comment row for the assignee and the creator", async () => {
    const proj = await insertProject();
    const actor = await insertUser();
    const creator = await insertUser();
    const assignee = await insertUser();
    const issueRow = await insertIssueRow(proj.id, creator.id, assignee.id);
    const commentRow = await insertComment(actor.id, { issueId: issueRow.id });

    await testDb.transaction((tx) =>
      writeCommentNotifications(tx, {
        commentId: commentRow.id,
        target: { issueId: issueRow.id },
        actorId: actor.id,
        body: "Looks good.",
      }),
    );

    const rows = await census();
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.type === "comment")).toBe(true);
    expect(new Set(rows.map((row) => row.userId))).toEqual(new Set([creator.id, assignee.id]));
  });

  it("writes exactly one row where the assignee is the creator", async () => {
    const proj = await insertProject();
    const actor = await insertUser();
    const both = await insertUser();
    const issueRow = await insertIssueRow(proj.id, both.id, both.id);
    const commentRow = await insertComment(actor.id, { issueId: issueRow.id });

    await testDb.transaction((tx) =>
      writeCommentNotifications(tx, {
        commentId: commentRow.id,
        target: { issueId: issueRow.id },
        actorId: actor.id,
        body: "Looks good.",
      }),
    );

    const rows = await census();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId: both.id, type: "comment" });
  });
});

describe("writeCommentNotifications — the project comment set is the membership list (FR-048, SC-007)", () => {
  it("writes a comment row for every explicit project_member row", async () => {
    const proj = await insertProject();
    const actor = await insertUser();
    const memberOne = await insertUser();
    const memberTwo = await insertUser();
    await addMember(proj.id, actor.id);
    await addMember(proj.id, memberOne.id);
    await addMember(proj.id, memberTwo.id);
    const commentRow = await insertComment(actor.id, { projectId: proj.id });

    await testDb.transaction((tx) =>
      writeCommentNotifications(tx, {
        commentId: commentRow.id,
        target: { projectId: proj.id },
        actorId: actor.id,
        body: "Looks good.",
      }),
    );

    const rows = await census();
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((row) => row.userId))).toEqual(new Set([memberOne.id, memberTwo.id]));
    expect(rows.every((row) => row.projectId === proj.id && row.issueId === null)).toBe(true);
  });

  it("writes nothing for an admin holding no membership row", async () => {
    const proj = await insertProject();
    const actor = await insertUser();
    await insertUser({ role: "admin" });
    await addMember(proj.id, actor.id);
    const commentRow = await insertComment(actor.id, { projectId: proj.id });
    const before = await census();

    const written = await testDb.transaction((tx) =>
      writeCommentNotifications(tx, {
        commentId: commentRow.id,
        target: { projectId: proj.id },
        actorId: actor.id,
        body: "Looks good.",
      }),
    );

    expect(written).toEqual([]);
    expect(await census()).toEqual(before);
  });

  it("writes the mentions of a project with no members at all", async () => {
    const proj = await insertProject();
    const actor = await insertUser();
    const named = await insertUser();
    const commentRow = await insertComment(actor.id, { projectId: proj.id });

    await testDb.transaction((tx) =>
      writeCommentNotifications(tx, {
        commentId: commentRow.id,
        target: { projectId: proj.id },
        actorId: actor.id,
        body: `@[${named.id}]`,
      }),
    );

    const rows = await census();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId: named.id, type: "mention", projectId: proj.id });
  });
});

describe("writeCommentNotifications — mention wins over comment (FR-040, research F-2)", () => {
  it("writes one row of type mention for a person who is both named and a listener", async () => {
    const proj = await insertProject();
    const actor = await insertUser();
    const both = await insertUser();
    const issueRow = await insertIssueRow(proj.id, both.id, both.id);
    const commentRow = await insertComment(actor.id, { issueId: issueRow.id });

    await testDb.transaction((tx) =>
      writeCommentNotifications(tx, {
        commentId: commentRow.id,
        target: { issueId: issueRow.id },
        actorId: actor.id,
        body: `@[${both.id}]`,
      }),
    );

    const rows = await census();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.type).toBe("mention");
  });
});

describe("writeCommentNotifications — one row per person per comment (FR-006, SC-006)", () => {
  it("inserts nothing and does not reject when a row for that person and comment already exists", async () => {
    const proj = await insertProject();
    const actor = await insertUser();
    const named = await insertUser();
    const issueRow = await insertIssueRow(proj.id, actor.id, null);
    const commentRow = await insertComment(actor.id, { issueId: issueRow.id });

    await testDb.transaction((tx) =>
      writeCommentNotifications(tx, {
        commentId: commentRow.id,
        target: { issueId: issueRow.id },
        actorId: actor.id,
        body: `@[${named.id}]`,
      }),
    );
    const afterFirst = await census();

    const written = await testDb.transaction((tx) =>
      writeCommentNotifications(tx, {
        commentId: commentRow.id,
        target: { issueId: issueRow.id },
        actorId: actor.id,
        body: `@[${named.id}]`,
      }),
    );

    expect(written).toEqual([]);
    expect(await census()).toEqual(afterFirst);
  });
});

describe("writeCommentNotifications — the grammar and the predicate it must not use (research B-2, B-9)", () => {
  it("imports MENTION_TOKEN_PATTERN from R7's mention-resolve rather than redeclaring it", () => {
    const source = readFileSync(WRITER_SOURCE, "utf8");
    expect(source).toContain(
      'import { MENTION_TOKEN_PATTERN } from "@/features/activity/server/mention-resolve"',
    );
  });

  it("never calls isMember", () => {
    const source = readFileSync(WRITER_SOURCE, "utf8");
    expect(source).not.toContain("isMember");
  });
});