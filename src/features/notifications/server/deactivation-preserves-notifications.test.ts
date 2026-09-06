import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { boardColumn, comment, issue, notification, project, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { deactivateAccount } from "@/features/accounts/server/accounts";

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
      email: `person-${crypto.randomUUID()}@example.com`,
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

async function insertProjectWithColumn() {
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
  return { proj, column };
}

async function insertIssue(projectId: string, columnId: string, createdBy: string) {
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
    })
    .returning();
  if (!row) {
    throw new Error("insertIssue produced no row");
  }
  return row;
}

async function insertComment(values: Partial<typeof comment.$inferInsert> & { authorId: string }) {
  const now = new Date();
  const [row] = await testDb
    .insert(comment)
    .values({ body: "Looks good.", createdAt: now, updatedAt: now, ...values })
    .returning();
  if (!row) {
    throw new Error("insertComment produced no row");
  }
  return row;
}

async function insertNotification(
  values: Pick<typeof notification.$inferInsert, "userId" | "actorId" | "type"> &
    Partial<typeof notification.$inferInsert>,
) {
  const now = new Date();
  const [row] = await testDb
    .insert(notification)
    .values({ createdAt: now, updatedAt: now, ...values })
    .returning();
  if (!row) {
    throw new Error("insertNotification produced no row");
  }
  return row;
}

async function census() {
  const rows = await testDb.select().from(notification);
  return rows.sort((left, right) => left.id.localeCompare(right.id));
}

async function seed() {
  const leaver = await insertUser({ firstName: "Ada", lastName: "Lovelace" });
  const colleague = await insertUser({ firstName: "Grace", lastName: "Hopper" });
  const { proj, column } = await insertProjectWithColumn();
  const issueRow = await insertIssue(proj.id, column.id, colleague.id);
  const commentRow = await insertComment({ authorId: colleague.id, issueId: issueRow.id });

  await insertNotification({
    userId: leaver.id,
    actorId: colleague.id,
    type: "assignment",
    issueId: issueRow.id,
  });
  await insertNotification({
    userId: leaver.id,
    actorId: colleague.id,
    type: "mention",
    issueId: issueRow.id,
    commentId: commentRow.id,
    readAt: new Date("2026-02-01T00:00:00.000Z"),
  });
  await insertNotification({
    userId: colleague.id,
    actorId: leaver.id,
    type: "comment",
    issueId: issueRow.id,
    commentId: commentRow.id,
  });

  return { leaver };
}

describe("deactivating a person keeps every notification they touch (FR-062)", () => {
  it("leaves the rows they receive and the rows they caused byte-for-byte", async () => {
    const seeded = await seed();
    const before = await census();

    const result = await deactivateAccount(seeded.leaver.id);

    expect(result).toBe("done");
    expect(before).toHaveLength(3);
    expect(await census()).toEqual(before);
  });

  it("marks the account closed without deleting the person a notification names", async () => {
    const seeded = await seed();

    await deactivateAccount(seeded.leaver.id);

    const [row] = await testDb.select().from(user).where(eq(user.id, seeded.leaver.id));
    expect(row?.deactivatedAt).not.toBeNull();
  });
});