import { beforeEach, describe, expect, it } from "vitest";
import { activity, boardColumn, comment, issue, project, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import type { Actor } from "@/features/auth/server/actor";
import { createColumn } from "@/features/projects/server/create-column";
import { deleteColumn } from "@/features/projects/server/delete-column";
import { moveColumn } from "@/features/projects/server/move-column";
import { updateColumn } from "@/features/projects/server/update-column";
import { collapseFeed } from "../components/collapse";
import { countProjectComments, listFeed } from "./feed-queries";

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

async function insertColumn(projectId: string, overrides: Partial<typeof boardColumn.$inferInsert> = {}) {
  const now = new Date();
  const [row] = await testDb
    .insert(boardColumn)
    .values({
      projectId,
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

async function insertComment(
  authorId: string,
  target: { issueId: string } | { projectId: string },
  overrides: Partial<typeof comment.$inferInsert> = {},
) {
  const [row] = await testDb
    .insert(comment)
    .values({
      authorId,
      body: "Looks good.",
      createdAt: new Date(),
      updatedAt: new Date(),
      ...target,
      ...overrides,
    })
    .returning();
  if (!row) {
    throw new Error("insertComment produced no row");
  }
  return row;
}

async function insertActivity(
  actorId: string,
  target: { issueId: string } | { projectId: string },
  overrides: Partial<typeof activity.$inferInsert> = {},
) {
  const [row] = await testDb
    .insert(activity)
    .values({ actorId, type: "created", createdAt: new Date(), ...target, ...overrides })
    .returning();
  if (!row) {
    throw new Error("insertActivity produced no row");
  }
  return row;
}

type Fixture = { userId: string; projectId: string; issueId: string };

async function fixture(): Promise<Fixture> {
  const authorRow = await insertUser();
  const projectRow = await insertProject();
  const columnRow = await insertColumn(projectRow.id);
  const issueRow = await insertIssue(projectRow.id, columnRow.id, authorRow.id);
  return { userId: authorRow.id, projectId: projectRow.id, issueId: issueRow.id };
}

describe("listFeed — scoping to one target (FR-014, OT-AUTHZ-002)", () => {
  it("returns only the given issue's own comment and activity rows", async () => {
    const fx = await fixture();
    const commentRow = await insertComment(fx.userId, { issueId: fx.issueId });
    const activityRow = await insertActivity(fx.userId, { issueId: fx.issueId });
    await insertComment(fx.userId, { projectId: fx.projectId });
    await insertActivity(fx.userId, { projectId: fx.projectId });

    const page = await listFeed({ issueId: fx.issueId }, { id: fx.userId, isAdmin: false });

    const ids = page.rows.map((row) => row.id).sort();
    expect(ids).toEqual([commentRow.id, activityRow.id].sort());
  });

  it("returns only the given project's own comment and activity rows", async () => {
    const fx = await fixture();
    const commentRow = await insertComment(fx.userId, { projectId: fx.projectId });
    const activityRow = await insertActivity(fx.userId, { projectId: fx.projectId });
    await insertComment(fx.userId, { issueId: fx.issueId });
    await insertActivity(fx.userId, { issueId: fx.issueId });

    const page = await listFeed({ projectId: fx.projectId }, { id: fx.userId, isAdmin: false });

    const ids = page.rows.map((row) => row.id).sort();
    expect(ids).toEqual([commentRow.id, activityRow.id].sort());
  });

  it("never filters a row by the viewer's own membership", async () => {
    const fx = await fixture();
    const outsider = await insertUser();
    const commentRow = await insertComment(fx.userId, { projectId: fx.projectId });

    const page = await listFeed({ projectId: fx.projectId }, { id: outsider.id, isAdmin: false });

    expect(page.rows.map((row) => row.id)).toContain(commentRow.id);
  });
});

describe("listFeed — ordering and pagination (FR-032, research F-1)", () => {
  it("orders newest first by (created_at, id) descending", async () => {
    const fx = await fixture();
    const base = new Date("2026-01-01T00:00:00.000Z");
    const older = await insertComment(fx.userId, { projectId: fx.projectId }, { createdAt: base });
    const newer = await insertComment(
      fx.userId,
      { projectId: fx.projectId },
      { createdAt: new Date(base.getTime() + 60_000) },
    );

    const page = await listFeed({ projectId: fx.projectId }, { id: fx.userId, isAdmin: false });

    expect(page.rows.map((row) => row.id)).toEqual([newer.id, older.id]);
  });

  it("returns the 50 most recent rows and reports a next page on a first call", async () => {
    const fx = await fixture();
    const base = new Date("2026-01-01T00:00:00.000Z");
    for (let i = 0; i < 55; i += 1) {
      await insertComment(
        fx.userId,
        { projectId: fx.projectId },
        { createdAt: new Date(base.getTime() + i * 1000) },
      );
    }

    const page = await listFeed({ projectId: fx.projectId }, { id: fx.userId, isAdmin: false });

    expect(page.rows).toHaveLength(50);
    expect(page.hasNextPage).toBe(true);
  });

  it("reports no next page once every row has been returned", async () => {
    const fx = await fixture();
    await insertComment(fx.userId, { projectId: fx.projectId });

    const page = await listFeed({ projectId: fx.projectId }, { id: fx.userId, isAdmin: false });

    expect(page.rows).toHaveLength(1);
    expect(page.hasNextPage).toBe(false);
  });

  it("a call with a cursor returns the next page intact across a row inserted between the two calls", async () => {
    const fx = await fixture();
    const base = new Date("2026-01-01T00:00:00.000Z");
    const rows = [];
    for (let i = 0; i < 3; i += 1) {
      rows.push(
        await insertComment(
          fx.userId,
          { projectId: fx.projectId },
          { createdAt: new Date(base.getTime() + i * 1000) },
        ),
      );
    }

    const firstPage = await listFeed(
      { projectId: fx.projectId },
      { id: fx.userId, isAdmin: false },
      undefined,
      2,
    );
    expect(firstPage.rows.map((row) => row.id)).toEqual([rows[2]?.id, rows[1]?.id]);
    expect(firstPage.hasNextPage).toBe(true);

    const insertedWhileReading = await insertComment(
      fx.userId,
      { projectId: fx.projectId },
      { createdAt: new Date(base.getTime() + 10_000) },
    );

    const lastRow = firstPage.rows.at(-1);
    if (!lastRow) {
      throw new Error("firstPage produced no rows");
    }
    const secondPage = await listFeed(
      { projectId: fx.projectId },
      { id: fx.userId, isAdmin: false },
      { createdAt: lastRow.createdAt, id: lastRow.id },
      2,
    );

    expect(secondPage.rows.map((row) => row.id)).toEqual([rows[0]?.id]);
    expect(secondPage.rows.map((row) => row.id)).not.toContain(insertedWhileReading.id);
  });
});

describe("listFeed — canEdit and canDelete (FR-032, data-model §4)", () => {
  it("computes canEdit and canDelete against the passed-in viewer id on a comment row", async () => {
    const fx = await fixture();
    const commentRow = await insertComment(fx.userId, { projectId: fx.projectId });

    const asAuthor = await listFeed({ projectId: fx.projectId }, { id: fx.userId, isAdmin: false });
    const authorRow = asAuthor.rows.find((row) => row.id === commentRow.id);
    expect(authorRow?.canEdit).toBe(true);
    expect(authorRow?.canDelete).toBe(true);

    const otherUser = await insertUser();
    const asOther = await listFeed({ projectId: fx.projectId }, { id: otherUser.id, isAdmin: false });
    const otherRow = asOther.rows.find((row) => row.id === commentRow.id);
    expect(otherRow?.canEdit).toBe(false);
    expect(otherRow?.canDelete).toBe(false);

    const asAdmin = await listFeed({ projectId: fx.projectId }, { id: otherUser.id, isAdmin: true });
    const adminRow = asAdmin.rows.find((row) => row.id === commentRow.id);
    expect(adminRow?.canEdit).toBe(false);
    expect(adminRow?.canDelete).toBe(true);
  });

  it("carries null canEdit and canDelete on an activity row", async () => {
    const fx = await fixture();
    const activityRow = await insertActivity(fx.userId, { projectId: fx.projectId });

    const page = await listFeed({ projectId: fx.projectId }, { id: fx.userId, isAdmin: false });

    const row = page.rows.find((candidate) => candidate.id === activityRow.id);
    expect(row?.canEdit).toBeNull();
    expect(row?.canDelete).toBeNull();
  });
});

describe("countProjectComments (FR-059)", () => {
  it("counts only comments attached to the project directly, not comments on its issues", async () => {
    const fx = await fixture();
    await insertComment(fx.userId, { projectId: fx.projectId });
    await insertComment(fx.userId, { projectId: fx.projectId });
    await insertComment(fx.userId, { issueId: fx.issueId });

    const count = await countProjectComments(fx.projectId);

    expect(count).toBe(2);
  });

  it("returns 0 for a project with no comments of its own", async () => {
    const fx = await fixture();
    await insertComment(fx.userId, { issueId: fx.issueId });

    const count = await countProjectComments(fx.projectId);

    expect(count).toBe(0);
  });

  it("does not count another project's own comments", async () => {
    const fx = await fixture();
    const otherProject = await insertProject();
    await insertComment(fx.userId, { projectId: otherProject.id });

    const count = await countProjectComments(fx.projectId);

    expect(count).toBe(0);
  });
});
function adminActorFor(row: { id: string; role: string }): Actor {
  return {
    id: row.id,
    role: row.role,
    firstName: "Ada",
    lastName: "Lovelace",
    avatarUrl: null,
    mustChangePassword: false,
  };
}

async function columnFixture() {
  const admin = await insertUser({ role: "admin" });
  const projectRow = await insertProject();
  const columnRow = await insertColumn(projectRow.id);
  const issueRow = await insertIssue(projectRow.id, columnRow.id, admin.id);
  return {
    actor: adminActorFor(admin),
    actorId: admin.id,
    projectId: projectRow.id,
    projectKey: projectRow.key,
    columnId: columnRow.id,
    issueId: issueRow.id,
  };
}

describe("listFeed — a column edit belongs to the project, never to an issue (FR-044, US5-6)", () => {
  it("shows a column edit on the project's feed and on no issue's feed in that project", async () => {
    const fx = await columnFixture();

    const created = await createColumn({ actor: fx.actor, projectKey: fx.projectKey, name: "Review" });
    expect(created.ok).toBe(true);

    const projectFeed = await listFeed({ projectId: fx.projectId }, { id: fx.actorId, isAdmin: true });
    expect(projectFeed.rows.map((row) => row.kind)).toEqual(["column_added"]);
    expect(projectFeed.rows[0]).toMatchObject({ actorId: fx.actorId, field: "Review" });

    const issueFeed = await listFeed({ issueId: fx.issueId }, { id: fx.actorId, isAdmin: true });
    expect(issueFeed.rows).toHaveLength(0);
  });
});

describe("listFeed — a run of column edits collapses into one line (FR-031, US5-7)", () => {
  it("folds four column edits by one admin inside five minutes into a single expandable group", async () => {
    const fx = await columnFixture();

    const created = await createColumn({ actor: fx.actor, projectKey: fx.projectKey, name: "Review" });
    if (!created.ok) {
      throw new Error("createColumn refused");
    }
    await updateColumn({ actor: fx.actor, columnId: created.column.id, name: "In Review" });
    await moveColumn({
      actor: fx.actor,
      columnId: created.column.id,
      targetColumnId: fx.columnId,
      placement: "before",
    });
    await deleteColumn({ actor: fx.actor, projectId: fx.projectId, columnId: created.column.id });

    const page = await listFeed({ projectId: fx.projectId }, { id: fx.actorId, isAdmin: true });
    expect(page.rows.map((row) => row.kind)).toEqual([
      "column_deleted",
      "column_reordered",
      "column_renamed",
      "column_added",
    ]);

    const groups = collapseFeed(page.rows);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(4);
  });
});