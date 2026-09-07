import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { activity, boardColumn, comment, issue, project, projectMember, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { createComment } from "@/features/activity/server/create-comment";
import type { Actor } from "@/features/auth/server/actor";
import { listInstallationActivity } from "./activity-queries";

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
  const [row] = await testDb
    .insert(boardColumn)
    .values({ projectId, name: "Backlog", kind: "open", sortOrder: "a0", createdAt: now, updatedAt: now })
    .returning();
  if (!row) {
    throw new Error("insertColumn produced no row");
  }
  return row;
}

async function insertIssue(projectId: string, columnId: string, createdBy: string) {
  const now = new Date();
  const [row] = await testDb
    .insert(issue)
    .values({
      projectId,
      number: 142,
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

function actorFor(userRow: { id: string; role: string; firstName: string; lastName: string }): Actor {
  return {
    id: userRow.id,
    role: userRow.role,
    firstName: userRow.firstName,
    lastName: userRow.lastName,
    avatarUrl: null,
    mustChangePassword: false,
  };
}

async function commentThroughTheRealWriter(target: { issueId: string } | { projectId: string }) {
  const projectId =
    "projectId" in target
      ? target.projectId
      : ((await testDb.select().from(issue).where(eq(issue.id, target.issueId)))[0]?.projectId ?? "");
  const author = await insertUser({ firstName: "Alan", lastName: "Turing" });
  const now = new Date();
  await testDb.insert(projectMember).values({ projectId, userId: author.id, createdAt: now, updatedAt: now });

  const result = await createComment({ target, actor: actorFor(author), body: "Looks good." });
  if (result.status !== "ok") {
    throw new Error(`createComment did not succeed: ${result.status}`);
  }
  return result.comment;
}

describe("Recent activity gives one comment exactly one row (FR-029, research F-2 #3, B-5)", () => {
  it("writes both records, so the fixture is the one the exclusion is needed for", async () => {
    const projectRow = await insertProject();

    const written = await commentThroughTheRealWriter({ projectId: projectRow.id });

    const commentRows = await testDb.select().from(comment).where(eq(comment.id, written.id));
    const activityRows = await testDb.select().from(activity).where(eq(activity.commentId, written.id));
    expect(commentRows).toHaveLength(1);
    expect(activityRows).toHaveLength(1);
    expect(activityRows[0]?.type).toBe("comment");
  });

  it("lists that comment once, and the row is the comment record rather than the log's record", async () => {
    const projectRow = await insertProject();

    const written = await commentThroughTheRealWriter({ projectId: projectRow.id });

    const rows = await listInstallationActivity();

    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(written.id);
    expect(rows[0]?.kind).toBe("comment");
  });

  it("keeps the same single row for a comment posted on an issue", async () => {
    const projectRow = await insertProject({ key: "WEB", name: "Website Redesign" });
    const creator = await insertUser();
    const column = await insertColumn(projectRow.id);
    const issueRow = await insertIssue(projectRow.id, column.id, creator.id);

    const written = await commentThroughTheRealWriter({ issueId: issueRow.id });

    const rows = await listInstallationActivity();

    expect(rows.filter((row) => row.kind === "comment")).toHaveLength(1);
    expect(rows.filter((row) => row.id === written.id)).toHaveLength(1);
    expect(rows.map((row) => row.id)).not.toContain(
      (await testDb.select().from(activity).where(eq(activity.commentId, written.id)))[0]?.id,
    );
  });

  it("does not drop a non-comment activity row alongside it", async () => {
    const projectRow = await insertProject();
    const written = await commentThroughTheRealWriter({ projectId: projectRow.id });
    const other = await insertUser();
    await testDb
      .insert(activity)
      .values({ actorId: other.id, type: "archived", projectId: projectRow.id, createdAt: new Date() });

    const rows = await listInstallationActivity();

    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((row) => row.kind))).toEqual(new Set(["comment", "archived"]));
    expect(rows.map((row) => row.id)).toContain(written.id);
  });
});