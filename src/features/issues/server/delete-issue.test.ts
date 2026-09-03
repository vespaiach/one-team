import { eq } from "drizzle-orm";
import postgres from "postgres";
import { beforeEach, describe, expect, it } from "vitest";
import { boardColumn, issue, issueCounter, project, projectMember, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import type { Actor } from "@/features/auth/server/actor";
import { createIssue } from "./create-issue";
import { deleteIssue } from "./delete-issue";

function requireTestDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error("TEST_DATABASE_URL is not set");
  }
  return url;
}

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

async function insertProjectWithColumnAndCounter() {
  const { proj, column } = await insertProjectWithColumn();
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

describe("deleteIssue — the admin-only predicate (FR-014, FR-056, SC-010, US5 s4)", () => {
  it("refuses a member who is not an admin, whether or not the disabled control was bypassed", async () => {
    const { proj, column } = await insertProjectWithColumn();
    const member = await insertUser({ role: "member" });
    await addMember(proj.id, member.id);
    const created = await insertIssue(proj.id, column.id, member.id);

    const result = await deleteIssue({ issueId: created.id, actor: actorFor(member) });

    expect(result.status).toBe("forbidden");
    const rows = await testDb.select().from(issue).where(eq(issue.id, created.id));
    expect(rows).toHaveLength(1);
  });

  it("deletes for an admin, membership or not", async () => {
    const { proj, column } = await insertProjectWithColumn();
    const admin = await insertUser({ role: "admin" });
    const created = await insertIssue(proj.id, column.id, admin.id);

    const result = await deleteIssue({ issueId: created.id, actor: actorFor(admin) });

    expect(result).toEqual({ status: "ok" });
    const rows = await testDb.select().from(issue).where(eq(issue.id, created.id));
    expect(rows).toHaveLength(0);
  });

  it("answers not-found for an issue id naming no row", async () => {
    const admin = await insertUser({ role: "admin" });

    const result = await deleteIssue({ issueId: crypto.randomUUID(), actor: actorFor(admin) });

    expect(result).toEqual({ status: "not-found" });
  });
});

describe("deleteIssue — one transaction that does not answer until it commits (FR-058, OT-DATA-008, SC-011)", () => {
  it("blocks behind a held row lock and only resolves once the lock is released", async () => {
    const { proj, column } = await insertProjectWithColumn();
    const admin = await insertUser({ role: "admin" });
    const created = await insertIssue(proj.id, column.id, admin.id);

    const heldConnection = postgres(requireTestDatabaseUrl(), { max: 1 });
    try {
      await heldConnection`BEGIN`;
      await heldConnection`SELECT * FROM issue WHERE id = ${created.id} FOR UPDATE`;

      let resolved = false;
      const deletion = deleteIssue({ issueId: created.id, actor: actorFor(admin) }).then((result) => {
        resolved = true;
        return result;
      });

      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(resolved).toBe(false);

      await heldConnection`COMMIT`;

      const result = await deletion;
      expect(result).toEqual({ status: "ok" });
      expect(resolved).toBe(true);
    } finally {
      await heldConnection.end();
    }
  });
});

describe("deleteIssue — the freed number is never reissued (FR-014, SC-003, US5 s5)", () => {
  it("draws a higher number for the project's next issue after the deleted one's number is freed", async () => {
    const { proj } = await insertProjectWithColumnAndCounter();
    const admin = await insertUser({ role: "admin" });

    const firstCreated = await createIssue({
      projectId: proj.id,
      actor: actorFor(admin),
      title: "First issue",
      description: null,
      columnId: null,
      priority: null,
      assigneeId: null,
      dueDate: null,
    });
    if (firstCreated.status !== "ok") {
      throw new Error(`unexpected create result: ${firstCreated.status}`);
    }
    expect(firstCreated.number).toBe(1);

    const [firstRow] = await testDb.select().from(issue).where(eq(issue.projectId, proj.id));
    if (!firstRow) {
      throw new Error("first issue row not found");
    }

    const deleteResult = await deleteIssue({ issueId: firstRow.id, actor: actorFor(admin) });
    expect(deleteResult).toEqual({ status: "ok" });

    const secondCreated = await createIssue({
      projectId: proj.id,
      actor: actorFor(admin),
      title: "Second issue",
      description: null,
      columnId: null,
      priority: null,
      assigneeId: null,
      dueDate: null,
    });
    if (secondCreated.status !== "ok") {
      throw new Error(`unexpected create result: ${secondCreated.status}`);
    }

    expect(secondCreated.number).toBe(2);
  });
});