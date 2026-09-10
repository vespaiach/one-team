import { generateKeyBetween } from "fractional-indexing";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { boardColumn, issue, issueLabel, label, project, user } from "@/db/schema";
import { truncateTestDatabase } from "@/db/test-database";
import { formatIssueKey } from "@/features/issues/issue-key";
import { listAssignedIssues } from "./assigned-queries";

const NOW = new Date("2026-01-01T00:00:00Z");

async function createUser(overrides: Partial<typeof user.$inferInsert> = {}) {
  const [row] = await db
    .insert(user)
    .values({
      firstName: "Ada",
      lastName: "Lovelace",
      email: `ada-${crypto.randomUUID()}@example.com`,
      createdAt: NOW,
      updatedAt: NOW,
      ...overrides,
    })
    .returning();
  if (!row) {
    throw new Error("failed to insert user");
  }
  return row;
}

async function createProject(overrides: Partial<typeof project.$inferInsert> = {}) {
  const [row] = await db
    .insert(project)
    .values({
      key: "APOLLO",
      name: "Apollo Platform",
      createdAt: NOW,
      updatedAt: NOW,
      ...overrides,
    })
    .returning();
  if (!row) {
    throw new Error("failed to insert project");
  }
  return row;
}

async function createColumn(
  projectId: string,
  overrides: Partial<typeof boardColumn.$inferInsert> & { name: string; kind: "open" | "done" | "canceled" },
) {
  const [row] = await db
    .insert(boardColumn)
    .values({
      projectId,
      sortOrder: generateKeyBetween(null, null),
      createdAt: NOW,
      updatedAt: NOW,
      ...overrides,
    })
    .returning();
  if (!row) {
    throw new Error("failed to insert column");
  }
  return row;
}

beforeEach(async () => {
  await truncateTestDatabase();
});

afterEach(async () => {
  await truncateTestDatabase();
});

describe("listAssignedIssues", () => {
  it("only returns issues sitting in an open-kind column, carrying column and label info", async () => {
    const assignee = await createUser();
    const creator = await createUser({ email: `creator-${crypto.randomUUID()}@example.com` });
    const proj = await createProject();
    const todo = await createColumn(proj.id, { name: "Todo", kind: "open" });
    const done = await createColumn(proj.id, { name: "Done", kind: "done" });
    const canceled = await createColumn(proj.id, { name: "Canceled", kind: "canceled" });
    const [labelRow] = await db
      .insert(label)
      .values({ name: "blocked", createdAt: NOW, updatedAt: NOW })
      .returning();
    if (!labelRow) {
      throw new Error("failed to insert label");
    }

    const [openIssue] = await db
      .insert(issue)
      .values({
        projectId: proj.id,
        number: 1,
        title: "Fix the flux capacitor",
        columnId: todo.id,
        priority: "high",
        assigneeId: assignee.id,
        createdBy: creator.id,
        sortOrder: generateKeyBetween(null, null),
        createdAt: NOW,
        updatedAt: NOW,
      })
      .returning();
    if (!openIssue) {
      throw new Error("failed to insert issue");
    }
    await db.insert(issueLabel).values({ issueId: openIssue.id, labelId: labelRow.id });

    await db.insert(issue).values([
      {
        projectId: proj.id,
        number: 2,
        title: "Already shipped",
        columnId: done.id,
        priority: "urgent",
        assigneeId: assignee.id,
        createdBy: creator.id,
        sortOrder: generateKeyBetween(null, null),
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        projectId: proj.id,
        number: 3,
        title: "Scrapped idea",
        columnId: canceled.id,
        priority: "urgent",
        assigneeId: assignee.id,
        createdBy: creator.id,
        sortOrder: generateKeyBetween(null, null),
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        projectId: proj.id,
        number: 4,
        title: "Someone else's work",
        columnId: todo.id,
        priority: "urgent",
        assigneeId: null,
        createdBy: creator.id,
        sortOrder: generateKeyBetween(null, null),
        createdAt: NOW,
        updatedAt: NOW,
      },
    ]);

    const rows = await listAssignedIssues(assignee.id);

    expect(rows).toHaveLength(1);
    const [row] = rows;
    expect(row?.key).toBe(formatIssueKey(proj.key, 1));
    expect(row?.projectKey).toBe(proj.key);
    expect(row?.label).toBe("blocked");
    expect(row?.column).toEqual({ id: todo.id, name: "Todo", kind: "open", sortOrder: todo.sortOrder });
  });

  it("carries a null label when the issue has none", async () => {
    const assignee = await createUser();
    const proj = await createProject();
    const todo = await createColumn(proj.id, { name: "Todo", kind: "open" });

    await db.insert(issue).values({
      projectId: proj.id,
      number: 1,
      title: "No labels here",
      columnId: todo.id,
      priority: "none",
      assigneeId: assignee.id,
      createdBy: assignee.id,
      sortOrder: generateKeyBetween(null, null),
      createdAt: NOW,
      updatedAt: NOW,
    });

    const rows = await listAssignedIssues(assignee.id);

    expect(rows[0]?.label).toBeNull();
  });
});