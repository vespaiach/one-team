import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { activity, boardColumn, issue, issueCounter, project, projectMember, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import type { Actor } from "@/features/auth/server/actor";
import { createIssue } from "./create-issue";

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

async function insertProjectWithColumnAndCounter() {
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
  await testDb.insert(issueCounter).values({ projectId: proj.id, lastNumber: 0 });
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

describe("createIssue — activity (FR-055, research D-5)", () => {
  it("writes one created row naming the actor, in the same transaction as the issue", async () => {
    const { proj } = await insertProjectWithColumnAndCounter();
    const member = await insertUser();
    await addMember(proj.id, member.id);

    const result = await createIssue({
      projectId: proj.id,
      actor: actorFor(member),
      title: "Fix the header",
      description: null,
      columnId: null,
      priority: "high",
      assigneeId: member.id,
      dueDate: "2026-06-15",
    });

    expect(result.status).toBe("ok");
    const [createdIssue] = await testDb.select().from(issue).where(eq(issue.projectId, proj.id));
    if (!createdIssue) throw new Error("expected an issue row");

    const rows = await testDb.select().from(activity).where(eq(activity.issueId, createdIssue.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: "created",
      actorId: member.id,
      field: null,
      fromValue: null,
      toValue: null,
    });
  });

  it("writes no field_changed row for any optional value set at creation", async () => {
    const { proj } = await insertProjectWithColumnAndCounter();
    const member = await insertUser();
    await addMember(proj.id, member.id);

    const result = await createIssue({
      projectId: proj.id,
      actor: actorFor(member),
      title: "Fix the header",
      description: null,
      columnId: null,
      priority: "urgent",
      assigneeId: member.id,
      dueDate: "2026-06-15",
    });

    expect(result.status).toBe("ok");
    const [createdIssue] = await testDb.select().from(issue).where(eq(issue.projectId, proj.id));
    if (!createdIssue) throw new Error("expected an issue row");
    const rows = await testDb.select().from(activity).where(eq(activity.issueId, createdIssue.id));
    expect(rows.every((row) => row.type !== "field_changed")).toBe(true);
  });
});