import { eq } from "drizzle-orm";
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

async function addMember(projectId: string, userId: string) {
  const now = new Date();
  await testDb.insert(projectMember).values({ projectId, userId, createdAt: now, updatedAt: now });
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

async function census() {
  const rows = await testDb
    .select({
      id: notification.id,
      userId: notification.userId,
      actorId: notification.actorId,
      type: notification.type,
      issueId: notification.issueId,
      projectId: notification.projectId,
      commentId: notification.commentId,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
    })
    .from(notification);
  return rows.sort((left, right) => left.id.localeCompare(right.id));
}

function mention(id: string) {
  return `@[${id}]`;
}

async function postComment(issueId: string, author: typeof user.$inferSelect, body: string) {
  const result = await createComment({
    target: { issueId },
    actor: actorFor(author),
    body,
  });
  if (result.status !== "ok") {
    throw new Error(`createComment refused with ${result.status}`);
  }
  return result.comment;
}

describe("updateComment — the mention diff, walkthrough 7 (FR-053…FR-056, SC-009)", () => {
  it("tells only the people the saved body newly names, and withdraws nothing", async () => {
    const proj = await insertProject();
    const author = await insertUser("Author");
    const ana = await insertUser("Ana");
    const ben = await insertUser("Ben");
    for (const person of [author, ana, ben]) {
      await addMember(proj.id, person.id);
    }
    const issueRow = await insertIssueRow(proj.id, author.id, null);

    const posted = await postComment(issueRow.id, author, `Hello ${mention(ana.id)}`);

    const afterPost = await census();
    expect(afterPost).toHaveLength(1);
    expect(afterPost[0]).toMatchObject({ userId: ana.id, type: "mention", commentId: posted.id });
    const anaRow = afterPost[0];

    const firstEdit = await updateComment({
      commentId: posted.id,
      actor: actorFor(author),
      body: `Hello ${mention(ana.id)} and ${mention(ben.id)}`,
    });
    expect(firstEdit).toEqual({ status: "ok" });

    const afterFirstEdit = await census();
    expect(afterFirstEdit).toHaveLength(2);
    expect(afterFirstEdit.filter((row) => row.userId === ana.id)).toEqual([anaRow]);
    const benRows = afterFirstEdit.filter((row) => row.userId === ben.id);
    expect(benRows).toHaveLength(1);
    expect(benRows[0]).toMatchObject({
      type: "mention",
      commentId: posted.id,
      issueId: issueRow.id,
      projectId: null,
      actorId: author.id,
      readAt: null,
    });

    const secondEdit = await updateComment({
      commentId: posted.id,
      actor: actorFor(author),
      body: `Hello ${mention(ben.id)} only`,
    });
    expect(secondEdit).toEqual({ status: "ok" });
    expect(await census()).toEqual(afterFirstEdit);

    const thirdEdit = await updateComment({
      commentId: posted.id,
      actor: actorFor(author),
      body: `Hello ${mention(ben.id)} only, with a clarification.`,
    });
    expect(thirdEdit).toEqual({ status: "ok" });
    expect(await census()).toEqual(afterFirstEdit);

    const fourthEdit = await updateComment({
      commentId: posted.id,
      actor: actorFor(author),
      body: `Hello ${mention(ben.id)} and ${mention(ana.id)} once more`,
    });
    expect(fourthEdit).toEqual({ status: "ok" });
    expect(await census()).toEqual(afterFirstEdit);

    expect((await census()).filter((row) => row.type === "comment")).toEqual([]);
  });

  it("writes no second row for a comment-row holder while the newcomer named beside them gets one", async () => {
    const proj = await insertProject();
    const author = await insertUser("Author");
    const assignee = await insertUser("Cass");
    const newcomer = await insertUser("Ben");
    for (const person of [author, assignee, newcomer]) {
      await addMember(proj.id, person.id);
    }
    const issueRow = await insertIssueRow(proj.id, author.id, assignee.id);

    const posted = await postComment(issueRow.id, author, "No names here.");

    const afterPost = await census();
    expect(afterPost).toHaveLength(1);
    expect(afterPost[0]).toMatchObject({ userId: assignee.id, type: "comment" });

    const edited = await updateComment({
      commentId: posted.id,
      actor: actorFor(author),
      body: `Now naming ${mention(assignee.id)} and ${mention(newcomer.id)}`,
    });

    expect(edited).toEqual({ status: "ok" });
    const after = await census();
    expect(after).toHaveLength(2);
    expect(after.filter((row) => row.userId === assignee.id)).toEqual(afterPost);
    expect(after.filter((row) => row.userId === newcomer.id)).toMatchObject([{ type: "mention" }]);
  });

  it("writes no row for the author naming themselves and none for a deactivated newcomer, only for the live one", async () => {
    const proj = await insertProject();
    const author = await insertUser("Author");
    const gone = await insertUser("Gone");
    const ben = await insertUser("Ben");
    for (const person of [author, gone, ben]) {
      await addMember(proj.id, person.id);
    }
    const issueRow = await insertIssueRow(proj.id, author.id, null);
    const posted = await postComment(issueRow.id, author, "Nobody yet.");
    await testDb.update(user).set({ deactivatedAt: new Date() }).where(eq(user.id, gone.id));

    expect(await census()).toEqual([]);
    const edited = await updateComment({
      commentId: posted.id,
      actor: actorFor(author),
      body: `${mention(author.id)}, ${mention(gone.id)} and ${mention(ben.id)}`,
    });

    expect(edited).toEqual({ status: "ok" });
    const after = await census();
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({ userId: ben.id, type: "mention" });
  });

  it("writes the diff of a project comment against the project target", async () => {
    const proj = await insertProject();
    const author = await insertUser("Author");
    const ben = await insertUser("Ben");
    for (const person of [author, ben]) {
      await addMember(proj.id, person.id);
    }

    const outsider = await insertUser("Outsider");

    const created = await createComment({
      target: { projectId: proj.id },
      actor: actorFor(author),
      body: "Nobody yet.",
    });
    if (created.status !== "ok") {
      throw new Error(`createComment refused with ${created.status}`);
    }

    const afterPost = await census();
    expect(afterPost).toMatchObject([{ userId: ben.id, type: "comment" }]);

    const edited = await updateComment({
      commentId: created.comment.id,
      actor: actorFor(author),
      body: `Ping ${mention(outsider.id)}`,
    });

    expect(edited).toEqual({ status: "ok" });
    const rows = await census();
    expect(rows).toHaveLength(2);
    expect(rows.filter((row) => row.userId === outsider.id)).toMatchObject([
      {
        type: "mention",
        issueId: null,
        projectId: proj.id,
        commentId: created.comment.id,
      },
    ]);
  });

  it("writes nothing when the edit is refused", async () => {
    const proj = await insertProject();
    const author = await insertUser("Author");
    const ben = await insertUser("Ben");
    const stranger = await insertUser("Stranger");
    for (const person of [author, ben, stranger]) {
      await addMember(proj.id, person.id);
    }
    const issueRow = await insertIssueRow(proj.id, author.id, null);
    const posted = await postComment(issueRow.id, author, "Nobody yet.");

    const before = await census();

    const forbidden = await updateComment({
      commentId: posted.id,
      actor: actorFor(stranger),
      body: `Ping ${mention(ben.id)}`,
    });
    expect(forbidden).toMatchObject({ status: "forbidden" });

    const invalid = await updateComment({
      commentId: posted.id,
      actor: actorFor(author),
      body: "   ",
    });
    expect(invalid).toMatchObject({ status: "invalid", field: "body", reason: "required" });

    expect(await census()).toEqual(before);

    const accepted = await updateComment({
      commentId: posted.id,
      actor: actorFor(author),
      body: `Ping ${mention(ben.id)}`,
    });
    expect(accepted).toEqual({ status: "ok" });
    expect(await census()).toMatchObject([{ userId: ben.id, type: "mention" }]);
  });
});