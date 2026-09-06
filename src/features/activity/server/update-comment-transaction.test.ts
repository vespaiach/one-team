import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { boardColumn, comment, issue, notification, project, projectMember, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import type { Actor } from "@/features/auth/server/actor";
import { dispatchNotificationMail } from "@/features/notifications/server/mail";
import { createComment } from "./create-comment";
import { updateComment } from "./update-comment";

vi.mock("@/features/notifications/server/mail", () => ({
  dispatchNotificationMail: vi.fn(),
  sendNotificationMail: vi.fn(),
}));

const MUTATOR_SOURCE = join(process.cwd(), "src", "features", "activity", "server", "update-comment.ts");

function requireTestDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error("TEST_DATABASE_URL is not set");
  }
  return url;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function tracked<T>(pending: Promise<T>): { hasSettled: () => boolean; result: Promise<T> } {
  let settled = false;
  const result = pending.then(
    (value) => {
      settled = true;
      return value;
    },
    (error: unknown) => {
      settled = true;
      throw error;
    },
  );
  return { hasSettled: () => settled, result };
}

beforeEach(async () => {
  vi.mocked(dispatchNotificationMail).mockClear();
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

function mention(id: string) {
  return `@[${id}]`;
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
  const stranger = await insertUser("Stranger");
  for (const person of [author, ben, cass, stranger]) {
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

  return { author, ben, cass, stranger, commentId: created.comment.id };
}

async function census() {
  return testDb.select().from(notification);
}

describe("updateComment — the body change and its rows share one transaction (FR-057, research B-6)", () => {
  it("lands the body and the row it produces together", async () => {
    const { author, ben, commentId } = await seedComment();

    const result = await updateComment({
      commentId,
      actor: actorFor(author),
      body: `Ping ${mention(ben.id)}`,
    });

    expect(result).toEqual({ status: "ok" });
    const [stored] = await testDb.select().from(comment).where(eq(comment.id, commentId));
    expect(stored?.body).toBe(`Ping ${mention(ben.id)}`);
    const rows = await census();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId: ben.id, type: "mention", commentId });
  });

  it("lands neither the body nor a row when the comment is deleted under the lock", async () => {
    const { author, ben, commentId } = await seedComment();

    const holder = postgres(requireTestDatabaseUrl(), { max: 1 });
    try {
      await holder`BEGIN`;
      await holder`SELECT id FROM comment WHERE id = ${commentId} FOR UPDATE`;
      await holder`DELETE FROM comment WHERE id = ${commentId}`;

      const edit = tracked(
        updateComment({ commentId, actor: actorFor(author), body: `Ping ${mention(ben.id)}` }),
      );
      await delay(300);
      expect(edit.hasSettled()).toBe(false);

      await holder`COMMIT`;
      expect(await edit.result).toEqual({ status: "not-found" });
    } finally {
      await holder.end();
    }

    expect(await testDb.select().from(comment).where(eq(comment.id, commentId))).toEqual([]);
    expect(await census()).toEqual([]);
  });
});

describe("updateComment — the locked read defines the body it replaces (FR-057, SC-006)", () => {
  it("waits for a held lock and diffs against the body the holder committed, not the stale one", async () => {
    const { author, ben, cass, commentId } = await seedComment();

    const holder = postgres(requireTestDatabaseUrl(), { max: 1 });
    try {
      await holder`BEGIN`;
      await holder`SELECT id FROM comment WHERE id = ${commentId} FOR UPDATE`;
      await holder`UPDATE comment SET body = ${`Ping ${mention(ben.id)}`} WHERE id = ${commentId}`;

      const edit = tracked(
        updateComment({
          commentId,
          actor: actorFor(author),
          body: `Ping ${mention(ben.id)} once more`,
        }),
      );
      await delay(300);
      expect(edit.hasSettled()).toBe(false);

      await holder`COMMIT`;
      expect(await edit.result).toEqual({ status: "ok" });
    } finally {
      await holder.end();
    }

    expect(await census()).toEqual([]);

    const later = await updateComment({
      commentId,
      actor: actorFor(author),
      body: `Ping ${mention(ben.id)} and ${mention(cass.id)}`,
    });
    expect(later).toEqual({ status: "ok" });
    expect(await census()).toMatchObject([{ userId: cass.id, type: "mention" }]);
  });
});

describe("updateComment — R7's refusals, order and result shape are unchanged (gate 7)", () => {
  it("gains a transaction with a locked read without widening its result", () => {
    const source = readFileSync(MUTATOR_SOURCE, "utf8");
    expect(source).toContain("db.transaction(");
    expect(source).toContain('.for("update")');
    expect(source).toContain(
      `export type UpdateCommentResult =
  | { status: "ok" }
  | { status: "forbidden"; reason: string }
  | { status: "not-found" }
  | { status: "invalid"; field: UpdateCommentField; reason: UpdateCommentInvalidReason };`,
    );
  });

  it("keeps the authorship read and parseCommentBody ahead of the transaction", () => {
    const source = readFileSync(MUTATOR_SOURCE, "utf8");
    const authorshipAt = source.indexOf("authorId: comment.authorId");
    const parseAt = source.indexOf("parseCommentBody(input.body)");
    const transactionAt = source.indexOf("db.transaction(");
    expect(authorshipAt).toBeGreaterThan(-1);
    expect(parseAt).toBeGreaterThan(-1);
    expect(transactionAt).toBeGreaterThan(-1);
    expect(authorshipAt).toBeLessThan(transactionAt);
    expect(parseAt).toBeLessThan(transactionAt);
  });

  it("refuses a non-author before touching the body or writing a row, where the author writes one", async () => {
    const { author, ben, stranger, commentId } = await seedComment();

    const result = await updateComment({
      commentId,
      actor: actorFor(stranger),
      body: `Ping ${mention(ben.id)}`,
    });

    expect(result).toEqual({
      status: "forbidden",
      reason: "Only the comment's author can edit it.",
    });
    const [stored] = await testDb.select().from(comment).where(eq(comment.id, commentId));
    expect(stored?.body).toBe("Nobody yet.");
    expect(await census()).toEqual([]);

    const byTheAuthor = await updateComment({
      commentId,
      actor: actorFor(author),
      body: `Ping ${mention(ben.id)}`,
    });
    expect(byTheAuthor).toEqual({ status: "ok" });
    expect(await census()).toMatchObject([{ userId: ben.id, type: "mention" }]);
  });

  it("refuses an unknown comment, an empty body and an over-long body exactly as R7 did", async () => {
    const { author, ben, commentId } = await seedComment();
    const actor = actorFor(author);

    expect(await updateComment({ commentId: crypto.randomUUID(), actor, body: "Edited." })).toEqual({
      status: "not-found",
    });
    expect(await updateComment({ commentId, actor, body: "   " })).toEqual({
      status: "invalid",
      field: "body",
      reason: "required",
    });
    expect(await updateComment({ commentId, actor, body: "a".repeat(10001) })).toEqual({
      status: "invalid",
      field: "body",
      reason: "too-long",
    });
    expect(await census()).toEqual([]);

    expect(await updateComment({ commentId, actor, body: `Ping ${mention(ben.id)}` })).toEqual({
      status: "ok",
    });
    expect(await census()).toMatchObject([{ userId: ben.id, type: "mention" }]);
  });
});

describe("updateComment — the mail dispatch runs after the commit, unawaited (FR-063, FR-065)", () => {
  it("hands the dispatcher exactly the ids the diff inserted", async () => {
    const { author, ben, commentId } = await seedComment();
    vi.mocked(dispatchNotificationMail).mockClear();

    await updateComment({ commentId, actor: actorFor(author), body: `Ping ${mention(ben.id)}` });

    const rows = await census();
    expect(rows).toHaveLength(1);
    expect(dispatchNotificationMail).toHaveBeenCalledTimes(1);
    expect(dispatchNotificationMail).toHaveBeenCalledWith(rows.map((row) => row.id));
  });

  it("hands the dispatcher nothing when the edit names nobody new", async () => {
    const { author, commentId } = await seedComment();
    vi.mocked(dispatchNotificationMail).mockClear();

    await updateComment({ commentId, actor: actorFor(author), body: "Still nobody." });

    expect(dispatchNotificationMail).toHaveBeenCalledTimes(1);
    expect(dispatchNotificationMail).toHaveBeenCalledWith([]);
  });

  it("dispatches nothing at all when the edit is refused before the transaction", async () => {
    const seeded = await seedComment();
    const { ben, stranger, commentId } = seeded;
    vi.mocked(dispatchNotificationMail).mockClear();

    await updateComment({
      commentId,
      actor: actorFor(stranger),
      body: `Ping ${mention(ben.id)}`,
    });

    expect(dispatchNotificationMail).not.toHaveBeenCalled();

    const { author } = seeded;
    await updateComment({ commentId, actor: actorFor(author), body: `Ping ${mention(ben.id)}` });
    expect(dispatchNotificationMail).toHaveBeenCalledTimes(1);
  });
});