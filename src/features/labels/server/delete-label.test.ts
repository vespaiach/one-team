import postgres from "postgres";
import { beforeEach, describe, expect, it } from "vitest";
import { boardColumn, issue, issueLabel, label, project, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import type { Actor } from "@/features/auth/server/actor";
import { deleteLabel } from "./delete-label";

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

function actor(overrides: Partial<Actor> = {}): Actor {
  return {
    id: crypto.randomUUID(),
    role: "admin",
    firstName: "Ada",
    lastName: "Lovelace",
    avatarUrl: null,
    mustChangePassword: false,
    ...overrides,
  };
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

let issueNumberCounter = 0;

async function insertIssue(projectId: string, columnId: string, createdBy: string, sortOrder: string) {
  const now = new Date();
  issueNumberCounter += 1;
  const [row] = await testDb
    .insert(issue)
    .values({
      projectId,
      number: issueNumberCounter,
      title: "Fix the header",
      columnId,
      createdBy,
      sortOrder,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!row) {
    throw new Error("insertIssue produced no row");
  }
  return row;
}

async function insertLabel(overrides: Partial<typeof label.$inferInsert> = {}) {
  const now = new Date();
  const [row] = await testDb
    .insert(label)
    .values({
      name: `Bug-${crypto.randomUUID()}`,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    })
    .returning();
  if (!row) {
    throw new Error("insertLabel produced no row");
  }
  return row;
}

describe("deleteLabel — authorization (FR-012)", () => {
  it("refuses a non-admin, leaving the label in place", async () => {
    const existing = await insertLabel();

    const result = await deleteLabel({ actor: actor({ role: "member" }), id: existing.id });

    expect(result).toEqual({ ok: false, error: "forbidden" });
    const rows = await testDb.select().from(label);
    expect(rows).toHaveLength(1);
  });
});

describe("deleteLabel — not found", () => {
  it("returns not_found for a missing id", async () => {
    const result = await deleteLabel({ actor: actor(), id: crypto.randomUUID() });
    expect(result).toEqual({ ok: false, error: "not_found" });
  });
});

describe("deleteLabel — the count matches a fresh COUNT(*) read inside the same transaction (FR-011, FR-012, research C-4)", () => {
  it("returns removedFromIssueCount matching the number of issues carrying it", async () => {
    const { proj, column } = await insertProjectWithColumn();
    const creator = await insertUser();
    const issueOne = await insertIssue(proj.id, column.id, creator.id, "a0");
    const issueTwo = await insertIssue(proj.id, column.id, creator.id, "a1");
    const target = await insertLabel();
    await testDb.insert(issueLabel).values([
      { issueId: issueOne.id, labelId: target.id },
      { issueId: issueTwo.id, labelId: target.id },
    ]);

    const result = await deleteLabel({ actor: actor(), id: target.id });

    expect(result).toEqual({ ok: true, removedFromIssueCount: 2 });
  });

  it("deletes a label carried by zero issues fine, with removedFromIssueCount: 0", async () => {
    const target = await insertLabel();

    const result = await deleteLabel({ actor: actor(), id: target.id });

    expect(result).toEqual({ ok: true, removedFromIssueCount: 0 });
  });
});

describe("deleteLabel — the cascade, settled and visible from a second connection (FR-012)", () => {
  it("removes the label row and every issue_label row naming it, leaving the issues themselves otherwise unchanged", async () => {
    const { proj, column } = await insertProjectWithColumn();
    const creator = await insertUser();
    const carrier = await insertIssue(proj.id, column.id, creator.id, "a0");
    const untouchedTitle = carrier.title;
    const untouchedUpdatedAt = carrier.updatedAt;
    const target = await insertLabel();
    await testDb.insert(issueLabel).values({ issueId: carrier.id, labelId: target.id });

    const result = await deleteLabel({ actor: actor(), id: target.id });
    expect(result).toEqual({ ok: true, removedFromIssueCount: 1 });

    const secondConnection = postgres(requireTestDatabaseUrl(), { max: 1 });
    try {
      const labelRows = await secondConnection`SELECT id FROM label WHERE id = ${target.id}`;
      expect(labelRows).toHaveLength(0);

      const attachmentRows =
        await secondConnection`SELECT issue_id FROM issue_label WHERE label_id = ${target.id}`;
      expect(attachmentRows).toHaveLength(0);

      const issueRows = await secondConnection<{ id: string; title: string; updated_at: Date }[]>`
        SELECT id, title, updated_at FROM issue WHERE id = ${carrier.id}
      `;
      expect(issueRows).toHaveLength(1);
      expect(issueRows[0]?.title).toBe(untouchedTitle);
      expect(issueRows[0]?.updated_at.toISOString()).toBe(untouchedUpdatedAt.toISOString());
    } finally {
      await secondConnection.end();
    }
  });
});