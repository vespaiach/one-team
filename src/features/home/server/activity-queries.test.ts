import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { activity, boardColumn, comment, issue, project, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { listInstallationActivity } from "./activity-queries";

const SOURCE = readFileSync(
  join(process.cwd(), "src", "features", "home", "server", "activity-queries.ts"),
  "utf8",
);

const MINUTE_MS = 60 * 1000;

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

async function insertColumn(projectId: string) {
  const now = new Date();
  const [row] = await testDb
    .insert(boardColumn)
    .values({ projectId, name: "Backlog", kind: "open", sortOrder: "a0", createdAt: now, updatedAt: now })
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

async function insertActivity(
  actorId: string,
  target: { issueId: string } | { projectId: string },
  createdAt: Date,
  overrides: Partial<typeof activity.$inferInsert> = {},
) {
  const [row] = await testDb
    .insert(activity)
    .values({
      actorId,
      type: "created",
      issueId: "issueId" in target ? target.issueId : null,
      projectId: "projectId" in target ? target.projectId : null,
      createdAt,
      ...overrides,
    })
    .returning();
  if (!row) {
    throw new Error("insertActivity produced no row");
  }
  return row;
}

async function insertComment(
  authorId: string,
  target: { issueId: string } | { projectId: string },
  createdAt: Date,
) {
  const [row] = await testDb
    .insert(comment)
    .values({
      authorId,
      body: "Looks good.",
      issueId: "issueId" in target ? target.issueId : null,
      projectId: "projectId" in target ? target.projectId : null,
      createdAt,
      updatedAt: createdAt,
    })
    .returning();
  if (!row) {
    throw new Error("insertComment produced no row");
  }
  return row;
}

describe("listInstallationActivity is bounded at twenty, newest first (FR-028, FR-033, US4 s1, s2, SC-008)", () => {
  it("returns exactly twenty rows when more than twenty exist, newest first", async () => {
    const actorRow = await insertUser();
    const projectRow = await insertProject();
    const base = Date.now();

    for (let index = 0; index < 25; index += 1) {
      await insertActivity(actorRow.id, { projectId: projectRow.id }, new Date(base - index * MINUTE_MS), {
        type: "field_changed",
        field: `field-${index}`,
      });
    }

    const rows = await listInstallationActivity();

    expect(rows).toHaveLength(20);
    expect(rows.map((row) => row.field)).toEqual(Array.from({ length: 20 }, (_, index) => `field-${index}`));
  });

  it("takes its bound from a module constant and accepts no caller-supplied limit (contracts §4)", () => {
    expect(listInstallationActivity.length).toBe(0);
    expect(SOURCE).toMatch(/^const [A-Z_]+ = 20;$/m);
  });
});

describe("listInstallationActivity spans the installation without filtering (FR-034, US4 s5)", () => {
  it("returns rows from every project and issue for a viewer who is a member of nothing", async () => {
    const actorRow = await insertUser();
    const first = await insertProject({ key: "WEB", name: "Website Redesign" });
    const second = await insertProject({ key: "API", name: "Platform API" });
    const column = await insertColumn(first.id);
    const issueRow = await insertIssue(first.id, column.id, actorRow.id, { number: 142 });
    const base = Date.now();

    await insertActivity(actorRow.id, { projectId: first.id }, new Date(base - 3 * MINUTE_MS));
    await insertActivity(actorRow.id, { projectId: second.id }, new Date(base - 2 * MINUTE_MS));
    await insertActivity(actorRow.id, { issueId: issueRow.id }, new Date(base - MINUTE_MS));

    const rows = await listInstallationActivity();

    expect(rows).toHaveLength(3);
    expect(new Set(rows.map((row) => row.projectName))).toEqual(
      new Set(["Website Redesign", "Platform API"]),
    );
  });

  it("applies no project-status filter, so an archived project's rows still list", async () => {
    const actorRow = await insertUser();
    const archived = await insertProject({ key: "OLD", name: "Retired Site", status: "archived" });

    await insertActivity(actorRow.id, { projectId: archived.id }, new Date());

    const rows = await listInstallationActivity();

    expect(rows).toHaveLength(1);
    expect(rows[0]?.projectName).toBe("Retired Site");
  });
});

describe("listInstallationActivity orders deterministically across the union (FR-036, CHK012, SC-012)", () => {
  it("resolves a tie between a comment row and an activity row identically across two reads", async () => {
    const actorRow = await insertUser();
    const projectRow = await insertProject();
    const tie = new Date();

    await insertComment(actorRow.id, { projectId: projectRow.id }, tie);
    await insertActivity(actorRow.id, { projectId: projectRow.id }, tie);

    const first = await listInstallationActivity();
    const second = await listInstallationActivity();

    expect(first).toHaveLength(2);
    expect(first.map((row) => row.id)).toEqual(second.map((row) => row.id));
    expect(first[0]?.id).toBe([...first.map((row) => row.id)].sort().reverse()[0]);
  });
});

describe("listInstallationActivity names its actor, its target and its project (FR-030, FR-037, US4 s4)", () => {
  it("labels an issue row with the issue key and names the project", async () => {
    const actorRow = await insertUser({ firstName: "Alan", lastName: "Turing" });
    const projectRow = await insertProject({ key: "WEB", name: "Website Redesign" });
    const column = await insertColumn(projectRow.id);
    const issueRow = await insertIssue(projectRow.id, column.id, actorRow.id, { number: 142 });

    await insertActivity(actorRow.id, { issueId: issueRow.id }, new Date());

    const rows = await listInstallationActivity();

    expect(rows[0]?.targetLabel).toBe("WEB-142 · Fix the header");
    expect(rows[0]?.projectName).toBe("Website Redesign");
    expect(rows[0]?.href).toBe("/projects/WEB/issues/142/details");
  });

  it("labels a project row with the project's name", async () => {
    const actorRow = await insertUser();
    const projectRow = await insertProject({ key: "WEB", name: "Website Redesign" });

    await insertActivity(actorRow.id, { projectId: projectRow.id }, new Date());

    const rows = await listInstallationActivity();

    expect(rows[0]?.targetLabel).toBe("Website Redesign");
    expect(rows[0]?.href).toBe("/projects/WEB");
  });

  it("carries the shared public projection and nothing wider", async () => {
    const actorRow = await insertUser({ firstName: "Alan", lastName: "Turing" });
    const projectRow = await insertProject();

    await insertActivity(actorRow.id, { projectId: projectRow.id }, new Date());

    const rows = await listInstallationActivity();

    expect(Object.keys(rows[0]?.actor ?? {}).sort()).toEqual(
      ["avatarUrl", "deactivatedAt", "firstName", "id", "jobTitle", "lastName", "role"].sort(),
    );
  });
});

describe("listInstallationActivity never collapses and never reads the feed toggle (FR-031, FR-032, C-5)", () => {
  it("renders five changes by one actor inside five minutes as five rows", async () => {
    const actorRow = await insertUser();
    const projectRow = await insertProject();
    const base = Date.now();

    for (let index = 0; index < 5; index += 1) {
      await insertActivity(actorRow.id, { projectId: projectRow.id }, new Date(base - index * MINUTE_MS), {
        type: "field_changed",
        field: `field-${index}`,
      });
    }

    const rows = await listInstallationActivity();

    expect(rows).toHaveLength(5);
  });

  it("imports none of R7's feed machinery and reads no feed_filter", () => {
    expect(SOURCE).not.toMatch(/listFeed/);
    expect(SOURCE).not.toMatch(/collapseFeed/);
    expect(SOURCE).not.toMatch(/filterFeedRows/);
    expect(SOURCE).not.toMatch(/getFeedFilter/);
    expect(SOURCE).not.toMatch(/setFeedFilter/);
    expect(SOURCE).not.toMatch(/feedFilter|feed_filter/);
    expect(SOURCE).not.toMatch(/feed-queries/);
    expect(SOURCE).not.toMatch(/feed-filter/);
  });
});