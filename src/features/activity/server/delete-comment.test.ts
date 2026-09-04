import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { activity, comment, project, projectMember, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import type { Actor } from "@/features/auth/server/actor";
import { deleteComment } from "./delete-comment";
import { writeActivity } from "./write-activity";

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

async function addMember(projectId: string, userId: string) {
  const now = new Date();
  await testDb.insert(projectMember).values({ projectId, userId, createdAt: now, updatedAt: now });
}

async function insertComment(overrides: Partial<typeof comment.$inferInsert> & { authorId: string }) {
  const now = new Date();
  const [row] = await testDb
    .insert(comment)
    .values({
      body: "Take this down.",
      createdAt: now,
      updatedAt: now,
      ...overrides,
    })
    .returning();
  if (!row) {
    throw new Error("insertComment produced no row");
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

describe("deleteComment — hard delete (FR-048)", () => {
  it("removes the comment row for its own author", async () => {
    const projectRow = await insertProject();
    const author = await insertUser();
    await addMember(projectRow.id, author.id);
    const commentRow = await insertComment({ authorId: author.id, projectId: projectRow.id });

    const result = await deleteComment({ commentId: commentRow.id, actor: actorFor(author) });

    expect(result).toEqual({ status: "ok" });
    const rows = await testDb.select().from(comment).where(eq(comment.id, commentRow.id));
    expect(rows).toHaveLength(0);
  });

  it("removes the comment row for an admin who did not author it", async () => {
    const projectRow = await insertProject();
    const author = await insertUser();
    const admin = await insertUser({ role: "admin" });
    await addMember(projectRow.id, author.id);
    const commentRow = await insertComment({ authorId: author.id, projectId: projectRow.id });

    const result = await deleteComment({ commentId: commentRow.id, actor: actorFor(admin) });

    expect(result).toEqual({ status: "ok" });
    const rows = await testDb.select().from(comment).where(eq(comment.id, commentRow.id));
    expect(rows).toHaveLength(0);
  });

  it("removes its own comment-type activity row through the database cascade, not a second statement", async () => {
    const projectRow = await insertProject();
    const author = await insertUser();
    await addMember(projectRow.id, author.id);
    const commentRow = await insertComment({ authorId: author.id, projectId: projectRow.id });
    await testDb.transaction(async (tx) => {
      await writeActivity(tx, {
        type: "comment",
        target: { projectId: projectRow.id },
        actorId: author.id,
        commentId: commentRow.id,
      });
    });

    await deleteComment({ commentId: commentRow.id, actor: actorFor(author) });

    const activityRows = await testDb.select().from(activity).where(eq(activity.commentId, commentRow.id));
    expect(activityRows).toHaveLength(0);
  });
});

describe("deleteComment — predicate is authorship or isAdmin (FR-016, US3 s7)", () => {
  it("refuses a member who is neither author nor admin, deleting nothing", async () => {
    const projectRow = await insertProject();
    const author = await insertUser();
    const otherMember = await insertUser();
    await addMember(projectRow.id, author.id);
    await addMember(projectRow.id, otherMember.id);
    const commentRow = await insertComment({ authorId: author.id, projectId: projectRow.id });

    const result = await deleteComment({ commentId: commentRow.id, actor: actorFor(otherMember) });

    expect(result).toMatchObject({ status: "forbidden" });
    const rows = await testDb.select().from(comment).where(eq(comment.id, commentRow.id));
    expect(rows).toHaveLength(1);
  });
});

describe("deleteComment — a second delete of the same id (spec, Edge Cases)", () => {
  it("resolves to not-found rather than a second success", async () => {
    const projectRow = await insertProject();
    const author = await insertUser();
    await addMember(projectRow.id, author.id);
    const commentRow = await insertComment({ authorId: author.id, projectId: projectRow.id });

    const first = await deleteComment({ commentId: commentRow.id, actor: actorFor(author) });
    const second = await deleteComment({ commentId: commentRow.id, actor: actorFor(author) });

    expect(first).toEqual({ status: "ok" });
    expect(second).toEqual({ status: "not-found" });
  });
});

describe("deleteComment — unknown commentId (FR-019)", () => {
  it("resolves to not-found", async () => {
    const author = await insertUser();

    const result = await deleteComment({ commentId: crypto.randomUUID(), actor: actorFor(author) });

    expect(result).toEqual({ status: "not-found" });
  });
});