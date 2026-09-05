import { beforeEach, describe, expect, it } from "vitest";
import { boardColumn, issue, project, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { countIssuesByColumn } from "./column-queries";

beforeEach(async () => {
  await truncateTestDatabase();
});

async function insertUser() {
  const now = new Date();
  const [row] = await testDb
    .insert(user)
    .values({
      firstName: "Ada",
      lastName: "Lovelace",
      email: `ada-${crypto.randomUUID()}@example.com`,
      createdAt: now,
      updatedAt: now,
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

async function insertColumn(projectId: string, name: string, sortOrder: string) {
  const now = new Date();
  const [row] = await testDb
    .insert(boardColumn)
    .values({ projectId, name, kind: "open", sortOrder, createdAt: now, updatedAt: now })
    .returning();
  if (!row) {
    throw new Error("insertColumn produced no row");
  }
  return row;
}

async function insertIssue(projectId: string, columnId: string, createdBy: string, number: number) {
  const now = new Date();
  await testDb.insert(issue).values({
    projectId,
    number,
    title: `Issue ${number}`,
    columnId,
    createdBy,
    sortOrder: `a${number}`,
    createdAt: now,
    updatedAt: now,
  });
}

describe("countIssuesByColumn (FR-015, FR-034, research E-8)", () => {
  it("maps each column holding issues to its live count", async () => {
    const actor = await insertUser();
    const proj = await insertProject();
    const backlog = await insertColumn(proj.id, "Backlog", "a0");
    const todo = await insertColumn(proj.id, "Todo", "a1");
    await insertIssue(proj.id, backlog.id, actor.id, 1);
    await insertIssue(proj.id, backlog.id, actor.id, 2);
    await insertIssue(proj.id, todo.id, actor.id, 3);

    const counts = await countIssuesByColumn(testDb, proj.id);

    expect(counts.get(backlog.id)).toBe(2);
    expect(counts.get(todo.id)).toBe(1);
  });

  it("omits a column holding no issue rather than mapping it to zero", async () => {
    const proj = await insertProject();
    const empty = await insertColumn(proj.id, "Backlog", "a0");

    const counts = await countIssuesByColumn(testDb, proj.id);

    expect(counts.has(empty.id)).toBe(false);
  });

  it("excludes issues belonging to another project", async () => {
    const actor = await insertUser();
    const proj = await insertProject();
    const otherProject = await insertProject();
    const column = await insertColumn(proj.id, "Backlog", "a0");
    const otherColumn = await insertColumn(otherProject.id, "Backlog", "a0");
    await insertIssue(proj.id, column.id, actor.id, 1);
    await insertIssue(otherProject.id, otherColumn.id, actor.id, 1);

    const counts = await countIssuesByColumn(testDb, proj.id);

    expect(counts.has(otherColumn.id)).toBe(false);
    expect([...counts.keys()]).toEqual([column.id]);
  });

  it("reads through a transaction handle as well as through db", async () => {
    const actor = await insertUser();
    const proj = await insertProject();
    const column = await insertColumn(proj.id, "Backlog", "a0");
    await insertIssue(proj.id, column.id, actor.id, 1);

    const counts = await testDb.transaction(async (tx) => countIssuesByColumn(tx, proj.id));

    expect(counts.get(column.id)).toBe(1);
  });
});