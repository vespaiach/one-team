import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { boardColumn, issue, project, projectMember, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import type { Actor } from "@/features/auth/server/actor";
import { resolveIssueWriteAccess } from "./issue-queries";

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

async function removeMember(projectId: string, userId: string) {
  await testDb
    .delete(projectMember)
    .where(and(eq(projectMember.projectId, projectId), eq(projectMember.userId, userId)));
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

describe("resolveIssueWriteAccess — an admin needs no membership row (FR-018, FR-025, US4 s6)", () => {
  it("admits an admin who holds no project_member row at all", async () => {
    const { proj } = await insertProjectWithColumn();
    const admin = await insertUser({ role: "admin" });

    const access = await resolveIssueWriteAccess(actorFor(admin), proj);

    expect(access).toEqual({ canWrite: true, writeReason: "" });
  });
});

describe("resolveIssueWriteAccess — membership removed mid-session (FR-025, US4 s5)", () => {
  it("disables the controls on the next render, and removes no row the member wrote", async () => {
    const { proj, column } = await insertProjectWithColumn();
    const member = await insertUser();
    await addMember(proj.id, member.id);
    const created = await insertIssue(proj.id, column.id, member.id);

    const before = await resolveIssueWriteAccess(actorFor(member), proj);
    expect(before.canWrite).toBe(true);

    await removeMember(proj.id, member.id);

    const after = await resolveIssueWriteAccess(actorFor(member), proj);
    expect(after.canWrite).toBe(false);
    expect(after.writeReason).toBe("Only project members can edit issues in Website Redesign.");

    const [row] = await testDb.select().from(issue).where(eq(issue.id, created.id));
    expect(row).toBeDefined();
    expect(row?.title).toBe("Fix the header");
  });
});

describe("resolveIssueWriteAccess — membership granted mid-session (FR-025, edge case: membership granted)", () => {
  it("enables the controls on the next render, with no sign-out and no sign-in", async () => {
    const { proj } = await insertProjectWithColumn();
    const newcomer = await insertUser();

    const before = await resolveIssueWriteAccess(actorFor(newcomer), proj);
    expect(before.canWrite).toBe(false);

    await addMember(proj.id, newcomer.id);

    const after = await resolveIssueWriteAccess(actorFor(newcomer), proj);
    expect(after.canWrite).toBe(true);
    expect(after.writeReason).toBe("");
  });
});