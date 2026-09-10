import { beforeEach, describe, expect, it } from "vitest";
import { boardColumn, issue, project, projectMember, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { formatIssueKey } from "@/features/issues/issue-key";
import { listAssignedIssues } from "./assigned-queries";

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

async function insertColumn(projectId: string, kind: string, name: string) {
  const now = new Date();
  const [row] = await testDb
    .insert(boardColumn)
    .values({ projectId, name, kind, sortOrder: "a0", createdAt: now, updatedAt: now })
    .returning();
  if (!row) {
    throw new Error("insertColumn produced no row");
  }
  return row;
}

async function insertIssue(
  projectId: string,
  columnId: string,
  createdBy: string,
  overrides: Partial<typeof issue.$inferInsert> = {},
) {
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
      ...overrides,
    })
    .returning();
  if (!row) {
    throw new Error("insertIssue produced no row");
  }
  return row;
}

describe("listAssignedIssues applies no filter but the assignee (FR-010, FR-012, US1 s5)", () => {
  it("lists an issue in a done-kind and one in a canceled-kind column beside an open one", async () => {
    const viewer = await insertUser();
    const proj = await insertProject({ key: "WEB" });
    const open = await insertColumn(proj.id, "open", "Backlog");
    const done = await insertColumn(proj.id, "done", "Done");
    const canceled = await insertColumn(proj.id, "canceled", "Canceled");

    await insertIssue(proj.id, open.id, viewer.id, { number: 1, assigneeId: viewer.id });
    await insertIssue(proj.id, done.id, viewer.id, { number: 2, assigneeId: viewer.id });
    await insertIssue(proj.id, canceled.id, viewer.id, { number: 3, assigneeId: viewer.id });

    const rows = await listAssignedIssues(viewer.id);

    expect(rows.map((row) => row.key).sort()).toEqual(["WEB-1", "WEB-2", "WEB-3"]);
  });

  it("carries the issue's priority and due date", async () => {
    const viewer = await insertUser();
    const proj = await insertProject({ key: "WEB" });
    const open = await insertColumn(proj.id, "open", "Backlog");

    await insertIssue(proj.id, open.id, viewer.id, {
      number: 1,
      assigneeId: viewer.id,
      priority: "urgent",
      dueDate: "2026-09-09",
    });

    const [row] = await listAssignedIssues(viewer.id);

    expect(row?.priority).toBe("urgent");
    expect(row?.dueDate).toBe("2026-09-09");
  });

  it("carries a null due date and the 'none' default priority for an issue with neither set", async () => {
    const viewer = await insertUser();
    const proj = await insertProject({ key: "WEB" });
    const open = await insertColumn(proj.id, "open", "Backlog");

    await insertIssue(proj.id, open.id, viewer.id, { number: 1, assigneeId: viewer.id });

    const [row] = await listAssignedIssues(viewer.id);

    expect(row?.priority).toBe("none");
    expect(row?.dueDate).toBeNull();
  });

  it("lists an issue whose project is archived", async () => {
    const viewer = await insertUser();
    const archived = await insertProject({ key: "OLD", status: "archived" });
    const column = await insertColumn(archived.id, "open", "Backlog");

    await insertIssue(archived.id, column.id, viewer.id, { number: 7, assigneeId: viewer.id });

    const rows = await listAssignedIssues(viewer.id);

    expect(rows.map((row) => row.key)).toEqual(["OLD-7"]);
  });

  it("lists an issue in a project the viewer holds no membership row for", async () => {
    const viewer = await insertUser();
    const stranger = await insertUser({ firstName: "Grace", lastName: "Hopper" });
    const proj = await insertProject({ key: "OPS" });
    const column = await insertColumn(proj.id, "open", "Backlog");
    const now = new Date();
    await testDb
      .insert(projectMember)
      .values({ projectId: proj.id, userId: stranger.id, createdAt: now, updatedAt: now });

    await insertIssue(proj.id, column.id, stranger.id, { number: 4, assigneeId: viewer.id });

    const rows = await listAssignedIssues(viewer.id);

    expect(rows.map((row) => row.key)).toEqual(["OPS-4"]);
  });

  it("bounds the list at no row count", async () => {
    const viewer = await insertUser();
    const proj = await insertProject({ key: "BIG" });
    const column = await insertColumn(proj.id, "open", "Backlog");
    const now = new Date();

    await testDb.insert(issue).values(
      Array.from({ length: 105 }, (_, index) => ({
        projectId: proj.id,
        number: index + 1,
        title: `Issue ${index + 1}`,
        columnId: column.id,
        createdBy: viewer.id,
        assigneeId: viewer.id,
        sortOrder: "a0",
        createdAt: now,
        updatedAt: now,
      })),
    );

    const rows = await listAssignedIssues(viewer.id);

    expect(rows).toHaveLength(105);
  });
});

describe("listAssignedIssues row shape (FR-011, FR-013)", () => {
  it("carries the issue key, the title, the project name and the issue details href", async () => {
    const viewer = await insertUser();
    const proj = await insertProject({ key: "WEB", name: "Website Redesign" });
    const column = await insertColumn(proj.id, "open", "Backlog");
    const created = await insertIssue(proj.id, column.id, viewer.id, {
      number: 142,
      title: "Fix the header",
      assigneeId: viewer.id,
    });

    const [row] = await listAssignedIssues(viewer.id);

    expect(row).toMatchObject({
      id: created.id,
      key: formatIssueKey("WEB", 142),
      title: "Fix the header",
      projectName: "Website Redesign",
      href: "/projects/WEB/issues/142/details",
    });
  });
});

describe("listAssignedIssues ordering is deterministic (FR-036, SC-012)", () => {
  it("orders by created_at desc then id desc, and resolves a seeded tie identically across two reads", async () => {
    const viewer = await insertUser();
    const proj = await insertProject({ key: "WEB" });
    const column = await insertColumn(proj.id, "open", "Backlog");
    const older = new Date("2026-01-01T00:00:00.000Z");
    const tied = new Date("2026-02-01T00:00:00.000Z");

    const oldest = await insertIssue(proj.id, column.id, viewer.id, {
      number: 1,
      assigneeId: viewer.id,
      createdAt: older,
    });
    const tieA = await insertIssue(proj.id, column.id, viewer.id, {
      number: 2,
      assigneeId: viewer.id,
      createdAt: tied,
    });
    const tieB = await insertIssue(proj.id, column.id, viewer.id, {
      number: 3,
      assigneeId: viewer.id,
      createdAt: tied,
    });

    const first = await listAssignedIssues(viewer.id);
    const second = await listAssignedIssues(viewer.id);

    const tieOrderByIdDescending = [tieA.id, tieB.id].sort().reverse();
    expect(first.map((row) => row.id)).toEqual([...tieOrderByIdDescending, oldest.id]);
    expect(second.map((row) => row.id)).toEqual(first.map((row) => row.id));
  });
});

describe("listAssignedIssues is scoped to the caller (OT-AUTHZ-002)", () => {
  it("returns no issue assigned to another user", async () => {
    const viewer = await insertUser();
    const other = await insertUser({ firstName: "Grace", lastName: "Hopper" });
    const proj = await insertProject({ key: "WEB" });
    const column = await insertColumn(proj.id, "open", "Backlog");

    await insertIssue(proj.id, column.id, viewer.id, { number: 1, assigneeId: viewer.id });
    await insertIssue(proj.id, column.id, other.id, { number: 2, assigneeId: other.id });
    await insertIssue(proj.id, column.id, viewer.id, { number: 3, assigneeId: null });

    const rows = await listAssignedIssues(viewer.id);

    expect(rows.map((row) => row.key)).toEqual(["WEB-1"]);
  });
});