import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { boardColumn, issue, project, projectMember, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import type { Actor } from "@/features/auth/server/actor";
import { type UpdateIssueInput, updateIssue } from "./update-issue";

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

async function addMember(projectId: string, userId: string) {
  const now = new Date();
  await testDb.insert(projectMember).values({ projectId, userId, createdAt: now, updatedAt: now });
}

function actorFor(userRow: { id: string; role: string; firstName: string; lastName: string }): Actor {
  return {
    id: userRow.id,
    role: userRow.role,
    firstName: userRow.firstName,
    lastName: userRow.lastName,
    avatarUrl: null,
    mustChangePassword: false,
  };
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

describe("UpdateIssueInput — no field for project, number, creator or ordering index (FR-007, FR-055, SC-009, US3 s7)", () => {
  it("has no key named projectId, number, createdBy or sortOrder", () => {
    const input: UpdateIssueInput = {
      issueId: "issue-1",
      actor: {
        id: "actor-1",
        role: "member",
        firstName: "Ada",
        lastName: "Lovelace",
        avatarUrl: null,
        mustChangePassword: false,
      },
      title: "New title",
    };

    expect(Object.keys(input)).not.toContain("projectId");
    expect(Object.keys(input)).not.toContain("number");
    expect(Object.keys(input)).not.toContain("createdBy");
    expect(Object.keys(input)).not.toContain("sortOrder");
  });

  it("ignores project, number, creator and ordering-index values even when a caller attaches them to the object", async () => {
    const { proj, column } = await insertProjectWithColumn();
    const otherProject = await insertProjectWithColumn();
    const member = await insertUser();
    await addMember(proj.id, member.id);
    const created = await insertIssue(proj.id, column.id, member.id);

    const tampered = {
      issueId: created.id,
      actor: actorFor(member),
      title: "Updated by a member",
      projectId: otherProject.proj.id,
      number: 999,
      createdBy: "someone-else",
      sortOrder: "zzzz",
    } as UpdateIssueInput & {
      projectId: string;
      number: number;
      createdBy: string;
      sortOrder: string;
    };

    const result = await updateIssue(tampered);

    expect(result.status).toBe("ok");
    const [row] = await testDb.select().from(issue).where(eq(issue.id, created.id));
    expect(row?.title).toBe("Updated by a member");
    expect(row?.projectId).toBe(proj.id);
    expect(row?.number).toBe(created.number);
    expect(row?.createdBy).toBe(created.createdBy);
    expect(row?.sortOrder).toBe(created.sortOrder);
  });
});