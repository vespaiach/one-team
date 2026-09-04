import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { activity, comment, project, projectMember, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import type { Actor } from "@/features/auth/server/actor";
import { updateComment } from "./update-comment";

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
      body: "Original text.",
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

describe("updateComment — writes (FR-017, FR-047)", () => {
  it("updates body and updated_at through touched(), writing no activity row", async () => {
    const projectRow = await insertProject();
    const author = await insertUser();
    await addMember(projectRow.id, author.id);
    const commentRow = await insertComment({
      authorId: author.id,
      projectId: projectRow.id,
      body: "Original text.",
    });

    const result = await updateComment({
      commentId: commentRow.id,
      actor: actorFor(author),
      body: "Updated text.",
    });

    expect(result).toEqual({ status: "ok" });

    const [updated] = await testDb.select().from(comment).where(eq(comment.id, commentRow.id));
    expect(updated?.body).toBe("Updated text.");
    expect(updated?.updatedAt.getTime()).toBeGreaterThan(commentRow.updatedAt.getTime());

    const activityRows = await testDb.select().from(activity).where(eq(activity.projectId, projectRow.id));
    expect(activityRows).toHaveLength(0);
  });
});

describe("updateComment — predicate is authorship alone (FR-016, FR-017, US3 s4)", () => {
  it("refuses a member who is not the author", async () => {
    const projectRow = await insertProject();
    const author = await insertUser();
    const otherMember = await insertUser();
    await addMember(projectRow.id, author.id);
    await addMember(projectRow.id, otherMember.id);
    const commentRow = await insertComment({ authorId: author.id, projectId: projectRow.id });

    const result = await updateComment({
      commentId: commentRow.id,
      actor: actorFor(otherMember),
      body: "Hijacked.",
    });

    expect(result).toMatchObject({ status: "forbidden" });
    const [unchanged] = await testDb.select().from(comment).where(eq(comment.id, commentRow.id));
    expect(unchanged?.body).toBe("Original text.");
  });

  it("refuses an admin who is not the author — isAdmin grants no editing right", async () => {
    const projectRow = await insertProject();
    const author = await insertUser();
    const admin = await insertUser({ role: "admin" });
    await addMember(projectRow.id, author.id);
    const commentRow = await insertComment({ authorId: author.id, projectId: projectRow.id });

    const result = await updateComment({
      commentId: commentRow.id,
      actor: actorFor(admin),
      body: "Hijacked by admin.",
    });

    expect(result).toMatchObject({ status: "forbidden" });
  });

  it("lets an author who has since left the project keep editing", async () => {
    const projectRow = await insertProject();
    const author = await insertUser();
    await addMember(projectRow.id, author.id);
    const commentRow = await insertComment({ authorId: author.id, projectId: projectRow.id });

    await testDb.delete(projectMember).where(eq(projectMember.projectId, projectRow.id));

    const result = await updateComment({
      commentId: commentRow.id,
      actor: actorFor(author),
      body: "Edited after leaving.",
    });

    expect(result).toEqual({ status: "ok" });
    const [updated] = await testDb.select().from(comment).where(eq(comment.id, commentRow.id));
    expect(updated?.body).toBe("Edited after leaving.");
  });
});

describe("updateComment — body validation (FR-040, FR-041, US3 s8)", () => {
  it("refuses a whitespace-only edit and keeps the prior text", async () => {
    const projectRow = await insertProject();
    const author = await insertUser();
    await addMember(projectRow.id, author.id);
    const commentRow = await insertComment({
      authorId: author.id,
      projectId: projectRow.id,
      body: "Original text.",
    });

    const result = await updateComment({
      commentId: commentRow.id,
      actor: actorFor(author),
      body: "   \n\t  ",
    });

    expect(result).toMatchObject({ status: "invalid", field: "body", reason: "required" });
    const [unchanged] = await testDb.select().from(comment).where(eq(comment.id, commentRow.id));
    expect(unchanged?.body).toBe("Original text.");
  });

  it("refuses a 10001-character edit and keeps the prior text", async () => {
    const projectRow = await insertProject();
    const author = await insertUser();
    await addMember(projectRow.id, author.id);
    const commentRow = await insertComment({
      authorId: author.id,
      projectId: projectRow.id,
      body: "Original text.",
    });

    const result = await updateComment({
      commentId: commentRow.id,
      actor: actorFor(author),
      body: "a".repeat(10001),
    });

    expect(result).toMatchObject({ status: "invalid", field: "body", reason: "too-long" });
    const [unchanged] = await testDb.select().from(comment).where(eq(comment.id, commentRow.id));
    expect(unchanged?.body).toBe("Original text.");
  });
});

describe("updateComment — unknown commentId (FR-019)", () => {
  it("resolves to not-found", async () => {
    const author = await insertUser();

    const result = await updateComment({
      commentId: crypto.randomUUID(),
      actor: actorFor(author),
      body: "Edited.",
    });

    expect(result).toEqual({ status: "not-found" });
  });
});