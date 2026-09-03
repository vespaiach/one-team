import { beforeEach, describe, expect, it } from "vitest";
import { boardColumn, issue, project, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { loadIssueView } from "./issue-queries";

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

async function insertColumn(overrides: Partial<typeof boardColumn.$inferInsert> & { projectId: string }) {
  const now = new Date();
  const [row] = await testDb
    .insert(boardColumn)
    .values({
      name: "Backlog",
      kind: "open",
      sortOrder: "a0",
      createdAt: now,
      updatedAt: now,
      ...overrides,
    })
    .returning();
  if (!row) {
    throw new Error("insertColumn produced no row");
  }
  return row;
}

async function insertIssue(
  overrides: Partial<typeof issue.$inferInsert> & {
    projectId: string;
    columnId: string;
    createdBy: string;
  },
) {
  const now = new Date();
  const [row] = await testDb
    .insert(issue)
    .values({
      number: 1,
      title: "Fix the header",
      priority: "none",
      sortOrder: "a0",
      createdAt: now,
      updatedAt: now,
      ...overrides,
    })
    .returning();
  if (!row) {
    throw new Error("insertIssue produced no row");
  }
  return row;
}

describe("loadIssueView (FR-017, FR-045, data-model §4)", () => {
  it("resolves an issue from the pair of project key and issue number", async () => {
    const proj = await insertProject({ key: "WEB" });
    const column = await insertColumn({ projectId: proj.id, name: "Backlog" });
    const creator = await insertUser({ firstName: "Grace", lastName: "Hopper" });
    await insertIssue({
      projectId: proj.id,
      columnId: column.id,
      createdBy: creator.id,
      number: 142,
      title: "Ship the release",
    });

    const view = await loadIssueView("WEB", 142);

    expect(view).not.toBeNull();
    expect(view?.key).toBe("WEB-142");
    expect(view?.number).toBe(142);
    expect(view?.title).toBe("Ship the release");
    expect(view?.column).toEqual({ id: column.id, name: "Backlog" });
    expect(view?.project).toEqual({ key: "WEB", name: proj.name });
  });

  it("does not resolve a number that exists only in another project", async () => {
    await insertProject({ key: "WEB" });
    const other = await insertProject({ key: "API" });
    const column = await insertColumn({ projectId: other.id });
    const creator = await insertUser();
    await insertIssue({ projectId: other.id, columnId: column.id, createdBy: creator.id, number: 5 });

    expect(await loadIssueView("WEB", 5)).toBeNull();
  });

  it("returns null for a project key matching no project", async () => {
    expect(await loadIssueView("NOPE", 1)).toBeNull();
  });

  it("returns null for a number matching no issue in a project that does exist", async () => {
    const proj = await insertProject({ key: "WEB" });
    const column = await insertColumn({ projectId: proj.id });
    const creator = await insertUser();
    await insertIssue({ projectId: proj.id, columnId: column.id, createdBy: creator.id, number: 1 });

    expect(await loadIssueView("WEB", 999)).toBeNull();
  });

  it("carries the creator through the publicUser projection, with no contact fields", async () => {
    const proj = await insertProject({ key: "WEB" });
    const column = await insertColumn({ projectId: proj.id });
    const creator = await insertUser({ firstName: "Grace", lastName: "Hopper" });
    await insertIssue({ projectId: proj.id, columnId: column.id, createdBy: creator.id, number: 1 });

    const view = await loadIssueView("WEB", 1);

    expect(view?.createdBy).toMatchObject({ firstName: "Grace", lastName: "Hopper" });
    expect(view?.createdBy).not.toHaveProperty("email");
  });

  it("carries the assignee through the publicUser projection when one is set", async () => {
    const proj = await insertProject({ key: "WEB" });
    const column = await insertColumn({ projectId: proj.id });
    const creator = await insertUser();
    const assignee = await insertUser({ firstName: "Alan", lastName: "Turing" });
    await insertIssue({
      projectId: proj.id,
      columnId: column.id,
      createdBy: creator.id,
      assigneeId: assignee.id,
      number: 1,
    });

    const view = await loadIssueView("WEB", 1);

    expect(view?.assignee).toMatchObject({ firstName: "Alan", lastName: "Turing" });
    expect(view?.assignee).not.toHaveProperty("email");
  });

  it("carries a null assignee when the issue has none", async () => {
    const proj = await insertProject({ key: "WEB" });
    const column = await insertColumn({ projectId: proj.id });
    const creator = await insertUser();
    await insertIssue({ projectId: proj.id, columnId: column.id, createdBy: creator.id, number: 1 });

    const view = await loadIssueView("WEB", 1);

    expect(view?.assignee).toBeNull();
  });

  it("never carries sort_order in the DTO", async () => {
    const proj = await insertProject({ key: "WEB" });
    const column = await insertColumn({ projectId: proj.id });
    const creator = await insertUser();
    await insertIssue({ projectId: proj.id, columnId: column.id, createdBy: creator.id, number: 1 });

    const view = await loadIssueView("WEB", 1);

    expect(view).not.toBeNull();
    expect(view).not.toHaveProperty("sortOrder");
    expect(view).not.toHaveProperty("sort_order");
  });
});