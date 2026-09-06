import { beforeEach, describe, expect, it } from "vitest";
import { boardColumn, issue, notification, project, projectMember, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import type { Actor } from "@/features/auth/server/actor";
import { createComment } from "./create-comment";
import { updateComment } from "./update-comment";

beforeEach(async () => {
  await truncateTestDatabase();
});

async function insertUser(firstName: string) {
  const now = new Date();
  const [row] = await testDb
    .insert(user)
    .values({
      firstName,
      lastName: "Lovelace",
      email: `${firstName.toLowerCase()}-${crypto.randomUUID()}@example.com`,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!row) {
    throw new Error("insertUser produced no row");
  }
  return row;
}

function actorFor(person: typeof user.$inferSelect): Actor {
  return {
    id: person.id,
    role: person.role,
    firstName: person.firstName,
    lastName: person.lastName,
    avatarUrl: null,
    mustChangePassword: false,
  };
}

async function seedComment() {
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
  const author = await insertUser("Author");
  const ben = await insertUser("Ben");
  const cass = await insertUser("Cass");
  for (const person of [author, ben, cass]) {
    await testDb
      .insert(projectMember)
      .values({ projectId: proj.id, userId: person.id, createdAt: now, updatedAt: now });
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
  const [issueRow] = await testDb
    .insert(issue)
    .values({
      projectId: proj.id,
      number: 1,
      title: "Fix the header",
      columnId: column.id,
      createdBy: author.id,
      sortOrder: "a0",
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!issueRow) {
    throw new Error("insertIssue produced no row");
  }

  const created = await createComment({
    target: { issueId: issueRow.id },
    actor: actorFor(author),
    body: "Nobody yet.",
  });
  if (created.status !== "ok") {
    throw new Error(`createComment refused with ${created.status}`);
  }

  return { author, ben, cass, commentId: created.comment.id };
}

function mention(id: string) {
  return `@[${id}]`;
}

describe("updateComment under two racing edits (FR-006, SC-006, research F-3)", () => {
  it("leaves exactly one row when both edits add the same name, and refuses neither", async () => {
    const { author, ben, commentId } = await seedComment();
    const actor = actorFor(author);

    const [first, second] = await Promise.all([
      updateComment({ commentId, actor, body: `Ping ${mention(ben.id)} now` }),
      updateComment({ commentId, actor, body: `Ping ${mention(ben.id)} again` }),
    ]);

    expect(first).toEqual({ status: "ok" });
    expect(second).toEqual({ status: "ok" });

    const rows = await testDb.select().from(notification);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId: ben.id, type: "mention", commentId });
  });

  it("writes one row each when two racing edits add two different names", async () => {
    const { author, ben, cass, commentId } = await seedComment();
    const actor = actorFor(author);

    const [first, second] = await Promise.all([
      updateComment({ commentId, actor, body: `Ping ${mention(ben.id)}` }),
      updateComment({ commentId, actor, body: `Ping ${mention(cass.id)}` }),
    ]);

    expect(first).toEqual({ status: "ok" });
    expect(second).toEqual({ status: "ok" });

    const rows = await testDb.select().from(notification);
    expect(rows.map((row) => row.userId).sort()).toEqual([ben.id, cass.id].sort());
  });
});