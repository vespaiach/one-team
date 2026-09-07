import { beforeEach, describe, expect, it } from "vitest";
import { boardColumn, issue, project, projectMember, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { listMemberProjectsWithProgress } from "./project-queries";

beforeEach(async () => {
  await truncateTestDatabase();
});

const now = new Date();

let nextKeySuffix = 0;

function uniqueKey(): string {
  nextKeySuffix += 1;
  return `K${String(nextKeySuffix).padStart(3, "0")}`;
}

async function insertUser(role: "admin" | "member" = "member") {
  const [row] = await testDb
    .insert(user)
    .values({
      firstName: "Ada",
      lastName: "Lovelace",
      email: `ada-${crypto.randomUUID()}@example.com`,
      role,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!row) {
    throw new Error("insertUser produced no row");
  }
  return row;
}

async function insertProject(overrides: Partial<typeof project.$inferInsert> = {}) {
  const [row] = await testDb
    .insert(project)
    .values({
      key: uniqueKey(),
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

async function addMember(projectId: string, userId: string) {
  await testDb.insert(projectMember).values({ projectId, userId, createdAt: now, updatedAt: now });
}

async function insertColumn(projectId: string, name: string, kind: "open" | "done" | "canceled") {
  const [row] = await testDb
    .insert(boardColumn)
    .values({ projectId, name, kind, sortOrder: "a0", createdAt: now, updatedAt: now })
    .returning();
  if (!row) {
    throw new Error("insertColumn produced no row");
  }
  return row;
}

let nextIssueNumber = 0;

async function insertIssues(projectId: string, columnId: string, createdBy: string, howMany: number) {
  for (let index = 0; index < howMany; index += 1) {
    nextIssueNumber += 1;
    await testDb.insert(issue).values({
      projectId,
      number: nextIssueNumber,
      title: "Fix the header",
      columnId,
      createdBy,
      sortOrder: "a0",
      createdAt: now,
      updatedAt: now,
    });
  }
}

describe("listMemberProjectsWithProgress (FR-014…FR-018, FR-036)", () => {
  it("counts done over total-minus-canceled, so three of ten with two canceled is 3 of 8", async () => {
    const viewer = await insertUser();
    const target = await insertProject({ name: "Alpha" });
    await addMember(target.id, viewer.id);
    const open = await insertColumn(target.id, "Backlog", "open");
    const done = await insertColumn(target.id, "Done", "done");
    const canceled = await insertColumn(target.id, "Canceled", "canceled");
    await insertIssues(target.id, open.id, viewer.id, 5);
    await insertIssues(target.id, done.id, viewer.id, 3);
    await insertIssues(target.id, canceled.id, viewer.id, 2);

    const rows = await listMemberProjectsWithProgress(viewer.id);

    expect(rows).toEqual([
      {
        key: target.key,
        name: "Alpha",
        status: "active",
        href: `/projects/${target.key}`,
        done: 3,
        counted: 8,
      },
    ]);
  });

  it("counts issues across every done-kind column and excludes every canceled-kind column", async () => {
    const viewer = await insertUser();
    const target = await insertProject({ name: "Alpha" });
    await addMember(target.id, viewer.id);
    const firstDone = await insertColumn(target.id, "Shipped", "done");
    const secondDone = await insertColumn(target.id, "Released", "done");
    const firstCanceled = await insertColumn(target.id, "Canceled", "canceled");
    const secondCanceled = await insertColumn(target.id, "Abandoned", "canceled");
    const open = await insertColumn(target.id, "Backlog", "open");
    await insertIssues(target.id, firstDone.id, viewer.id, 2);
    await insertIssues(target.id, secondDone.id, viewer.id, 3);
    await insertIssues(target.id, firstCanceled.id, viewer.id, 4);
    await insertIssues(target.id, secondCanceled.id, viewer.id, 1);
    await insertIssues(target.id, open.id, viewer.id, 5);

    const [row] = await listMemberProjectsWithProgress(viewer.id);

    expect(row?.done).toBe(5);
    expect(row?.counted).toBe(10);
  });

  it("returns a row with a zero denominator for a project with no issues", async () => {
    const viewer = await insertUser();
    const target = await insertProject({ name: "Alpha" });
    await addMember(target.id, viewer.id);
    await insertColumn(target.id, "Backlog", "open");

    const rows = await listMemberProjectsWithProgress(viewer.id);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.done).toBe(0);
    expect(rows[0]?.counted).toBe(0);
  });

  it("returns a row with a zero denominator for a project whose every issue is canceled", async () => {
    const viewer = await insertUser();
    const target = await insertProject({ name: "Alpha" });
    await addMember(target.id, viewer.id);
    const canceled = await insertColumn(target.id, "Canceled", "canceled");
    await insertIssues(target.id, canceled.id, viewer.id, 4);

    const rows = await listMemberProjectsWithProgress(viewer.id);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.done).toBe(0);
    expect(rows[0]?.counted).toBe(0);
  });

  it("lists active projects only, so an archived project the viewer belongs to is absent", async () => {
    const viewer = await insertUser();
    const active = await insertProject({ name: "Alpha" });
    const archived = await insertProject({ name: "Beta", status: "archived" });
    await addMember(active.id, viewer.id);
    await addMember(archived.id, viewer.id);

    const rows = await listMemberProjectsWithProgress(viewer.id);

    expect(rows.map((row) => row.key)).toEqual([active.key]);
  });

  it("reads membership rows, so an admin never added to a project does not see it", async () => {
    const admin = await insertUser("admin");
    const owner = await insertUser();
    const unrelated = await insertProject({ name: "Alpha" });
    await addMember(unrelated.id, owner.id);

    const rows = await listMemberProjectsWithProgress(admin.id);

    expect(rows).toEqual([]);
  });

  it("orders by lower(name) then key, and two consecutive reads return an identical sequence", async () => {
    const viewer = await insertUser();
    const zebra = await insertProject({ key: "AAA", name: "Zebra" });
    const apple = await insertProject({ key: "ZZZ", name: "apple" });
    const sharedSecond = await insertProject({ key: "MMM", name: "Shared" });
    const sharedFirst = await insertProject({ key: "BBB", name: "Shared" });
    for (const each of [zebra, apple, sharedSecond, sharedFirst]) {
      await addMember(each.id, viewer.id);
    }

    const first = await listMemberProjectsWithProgress(viewer.id);
    const second = await listMemberProjectsWithProgress(viewer.id);

    expect(first.map((row) => row.key)).toEqual(["ZZZ", "BBB", "MMM", "AAA"]);
    expect(second).toEqual(first);
  });
});