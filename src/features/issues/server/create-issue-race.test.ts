import postgres from "postgres";
import { describe, expect, it } from "vitest";
import { boardColumn, issueCounter, project, projectMember, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import type { Actor } from "@/features/auth/server/actor";
import { createIssue } from "./create-issue";

function requireTestDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error("TEST_DATABASE_URL is not set");
  }
  return url;
}

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

function baseInput(projectId: string, actor: Actor, title: string) {
  return {
    projectId,
    actor,
    title,
    description: null,
    columnId: null,
    priority: null,
    assigneeId: null,
    dueDate: null,
  };
}

describe("createIssue's number draw under concurrency (FR-016, FR-063, SC-002, research E-2)", () => {
  it("blocks a second draw until a transaction holding the counter row's lock commits, then reads the next number", async () => {
    await truncateTestDatabase();
    const { proj } = await insertProjectWithColumnAndCounter();
    const member = await insertUser();
    await addMember(proj.id, member.id);

    const heldConnection = postgres(requireTestDatabaseUrl(), { max: 1 });
    try {
      await heldConnection`BEGIN`;
      const [drawnByHeldConnection] = await heldConnection<{ last_number: number }[]>`
        UPDATE issue_counter SET last_number = last_number + 1
        WHERE project_id = ${proj.id} RETURNING last_number
      `;
      expect(drawnByHeldConnection?.last_number).toBe(1);

      let secondResolved = false;
      const secondCreation = createIssue(baseInput(proj.id, actorFor(member), "Second creation")).then(
        (result) => {
          secondResolved = true;
          return result;
        },
      );

      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(secondResolved).toBe(false);

      await heldConnection`COMMIT`;

      const secondResult = await secondCreation;
      expect(secondResult.status).toBe("ok");
      if (secondResult.status === "ok") {
        expect(secondResult.number).toBe(2);
      }
    } finally {
      await heldConnection.end();
    }
  });

  it("two createIssue calls racing on the same project each receive a distinct number, and neither is refused", async () => {
    await truncateTestDatabase();
    const { proj } = await insertProjectWithColumnAndCounter();
    const member = await insertUser();
    await addMember(proj.id, member.id);

    const [first, second] = await Promise.all([
      createIssue(baseInput(proj.id, actorFor(member), "First racer")),
      createIssue(baseInput(proj.id, actorFor(member), "Second racer")),
    ]);

    expect(first.status).toBe("ok");
    expect(second.status).toBe("ok");
    const numbers = [first, second]
      .map((result) => (result.status === "ok" ? result.number : null))
      .sort((a, b) => (a ?? 0) - (b ?? 0));
    expect(numbers).toEqual([1, 2]);
  });
});