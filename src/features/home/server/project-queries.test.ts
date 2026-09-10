import { generateKeyBetween } from "fractional-indexing";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { boardColumn, issue, project, projectMember, user } from "@/db/schema";
import { truncateTestDatabase } from "@/db/test-database";
import { hasAnyProject, listMemberProjectsWithProgress } from "./project-queries";

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
    .values({ key: "APOLLO", name: "Apollo Platform", createdAt: NOW, updatedAt: NOW, ...overrides })
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

describe("listMemberProjectsWithProgress", () => {
  it("reports done/open counts, target-passed and the project's members", async () => {
    const viewer = await createUser();
    const teammate = await createUser({
      firstName: "Grace",
      lastName: "Hopper",
      email: `teammate-${crypto.randomUUID()}@example.com`,
    });
    const proj = await createProject({ targetDate: "2020-01-01" });
    await db.insert(projectMember).values([
      { projectId: proj.id, userId: viewer.id, createdAt: NOW, updatedAt: NOW },
      { projectId: proj.id, userId: teammate.id, createdAt: NOW, updatedAt: NOW },
    ]);
    const todo = await createColumn(proj.id, { name: "Todo", kind: "open" });
    const done = await createColumn(proj.id, { name: "Done", kind: "done" });
    const canceled = await createColumn(proj.id, { name: "Canceled", kind: "canceled" });

    await db.insert(issue).values([
      {
        projectId: proj.id,
        number: 1,
        title: "Open one",
        columnId: todo.id,
        createdBy: viewer.id,
        sortOrder: generateKeyBetween(null, null),
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        projectId: proj.id,
        number: 2,
        title: "Done one",
        columnId: done.id,
        createdBy: viewer.id,
        sortOrder: generateKeyBetween(null, null),
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        projectId: proj.id,
        number: 3,
        title: "Canceled one",
        columnId: canceled.id,
        createdBy: viewer.id,
        sortOrder: generateKeyBetween(null, null),
        createdAt: NOW,
        updatedAt: NOW,
      },
    ]);

    const [row] = await listMemberProjectsWithProgress(viewer.id);

    expect(row?.done).toBe(1);
    expect(row?.counted).toBe(2);
    expect(row?.openCount).toBe(1);
    expect(row?.targetPassed).toBe(true);
    expect(row?.members.map((member) => member.name).sort()).toEqual(["Ada Lovelace", "Grace Hopper"].sort());
  });

  it("reports a future target date as not passed", async () => {
    const viewer = await createUser();
    const proj = await createProject({ targetDate: "2099-01-01" });
    await db
      .insert(projectMember)
      .values({ projectId: proj.id, userId: viewer.id, createdAt: NOW, updatedAt: NOW });

    const [row] = await listMemberProjectsWithProgress(viewer.id);

    expect(row?.targetPassed).toBe(false);
  });
});

describe("hasAnyProject", () => {
  it("is false when no project exists", async () => {
    expect(await hasAnyProject()).toBe(false);
  });

  it("is true once a project exists, regardless of the viewer's membership", async () => {
    await createProject();

    expect(await hasAnyProject()).toBe(true);
  });
});