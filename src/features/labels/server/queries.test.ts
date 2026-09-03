import { beforeEach, describe, expect, it } from "vitest";
import { boardColumn, issue, issueLabel, label, project, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { checkLabelNameAvailable, listLabelOptionsForIssue, listLabelsWithUsage } from "./queries";

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

describe("listLabelsWithUsage (FR-003, data-model.md §3)", () => {
  it("returns every label alphabetical by lower(name)", async () => {
    await insertLabel({ name: "urgent" });
    await insertLabel({ name: "Bug" });
    await insertLabel({ name: "Feature" });

    const rows = await listLabelsWithUsage();

    expect(rows.map((row) => row.name)).toEqual(["Bug", "Feature", "urgent"]);
  });

  it("carries the real COUNT(*) of each label's issue_label rows across every project", async () => {
    const { proj, column } = await insertProjectWithColumn();
    const creator = await insertUser();
    const issueOne = await insertIssue(proj.id, column.id, creator.id, "a0");
    const issueTwo = await insertIssue(proj.id, column.id, creator.id, "a1");
    const carried = await insertLabel({ name: "Bug" });
    const unused = await insertLabel({ name: "Feature" });
    await testDb.insert(issueLabel).values([
      { issueId: issueOne.id, labelId: carried.id },
      { issueId: issueTwo.id, labelId: carried.id },
    ]);

    const rows = await listLabelsWithUsage();

    const carriedRow = rows.find((row) => row.id === carried.id);
    const unusedRow = rows.find((row) => row.id === unused.id);
    expect(carriedRow?.issueCount).toBe(2);
    expect(unusedRow?.issueCount).toBe(0);
  });

  it("returns an empty array when no labels exist", async () => {
    const rows = await listLabelsWithUsage();
    expect(rows).toEqual([]);
  });
});

describe("checkLabelNameAvailable (FR-007, research C-3)", () => {
  it("returns the holder on a case-insensitive match", async () => {
    const created = await insertLabel({ name: "Bug" });

    const holder = await checkLabelNameAvailable("BUG");

    expect(holder).toEqual({ id: created.id, name: "Bug" });
  });

  it("returns null when no label matches", async () => {
    await insertLabel({ name: "Bug" });

    const holder = await checkLabelNameAvailable("Feature");

    expect(holder).toBeNull();
  });
});

describe("listLabelOptionsForIssue (FR-015, FR-016, FR-017, data-model.md §3)", () => {
  it("returns every team label, applied true only for the ones a LEFT JOIN against this issue's issue_label rows matches", async () => {
    const { proj, column } = await insertProjectWithColumn();
    const creator = await insertUser();
    const targetIssue = await insertIssue(proj.id, column.id, creator.id, "a0");
    const otherIssue = await insertIssue(proj.id, column.id, creator.id, "a1");
    const carried = await insertLabel({ name: "Bug" });
    const carriedElsewhere = await insertLabel({ name: "Feature" });
    const carriedByNothing = await insertLabel({ name: "Urgent" });
    await testDb.insert(issueLabel).values([
      { issueId: targetIssue.id, labelId: carried.id },
      { issueId: otherIssue.id, labelId: carriedElsewhere.id },
    ]);

    const options = await listLabelOptionsForIssue(targetIssue.id);

    expect(options.find((option) => option.id === carried.id)?.applied).toBe(true);
    expect(options.find((option) => option.id === carriedElsewhere.id)?.applied).toBe(false);
    expect(options.find((option) => option.id === carriedByNothing.id)?.applied).toBe(false);
    expect(options).toHaveLength(3);
  });

  it("every option comes back applied: false when called with no issueId", async () => {
    await insertLabel({ name: "Bug" });
    await insertLabel({ name: "Feature" });

    const options = await listLabelOptionsForIssue();

    expect(options).toHaveLength(2);
    expect(options.every((option) => option.applied === false)).toBe(true);
  });
});