import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { boardColumn, issue, issueLabel, label, project, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import type { Actor } from "@/features/auth/server/actor";
import { createLabel } from "./create-label";
import { deleteLabel } from "./delete-label";
import { updateLabel } from "./update-label";

const SERVER_DIR = join(process.cwd(), "src", "features", "labels", "server");
const MUTATOR_FILES = ["create-label.ts", "update-label.ts", "delete-label.ts"];

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

describe("label curation writes no activity — the mutator modules import nothing from an activity writer (FR-013)", () => {
  for (const file of MUTATOR_FILES) {
    it(`${file} imports nothing and calls nothing named "activity"`, () => {
      const source = readFileSync(join(SERVER_DIR, file), "utf8");
      expect(source.toLowerCase()).not.toContain("activity");
    });
  }
});

describe("label curation writes no activity — behaviourally, on a label carrying issues (FR-013)", () => {
  it("creates, renames and deletes a label carried by an issue without touching any activity history", async () => {
    const { proj, column } = await insertProjectWithColumn();
    const creator = await insertUser();
    const carrier = await insertIssue(proj.id, column.id, creator.id);
    const admin = actor();

    const created = await createLabel({ actor: admin, name: `Bug-${crypto.randomUUID()}` });
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error("unreachable");

    await testDb.insert(issueLabel).values({ issueId: carrier.id, labelId: created.label.id });

    const renamed = await updateLabel({
      actor: admin,
      id: created.label.id,
      name: `Renamed-${crypto.randomUUID()}`,
    });
    expect(renamed.ok).toBe(true);

    const deleted = await deleteLabel({ actor: admin, id: created.label.id });
    expect(deleted).toEqual({ ok: true, removedFromIssueCount: 1 });

    const rows = await testDb.select().from(label);
    expect(rows).toHaveLength(0);
  });
});