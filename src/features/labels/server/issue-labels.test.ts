import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { boardColumn, issue, issueLabel, label, project, projectMember, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import type { Actor } from "@/features/auth/server/actor";
import { addIssueLabel, removeIssueLabel } from "./issue-labels";

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

describe("addIssueLabel — authorization derived from the issue's own project (FR-019, FR-020, research C-1)", () => {
  it("a member of the issue's project adds a label", async () => {
    const { proj, column } = await insertProjectWithColumn();
    const member = await insertUser();
    await addMember(proj.id, member.id);
    const createdIssue = await insertIssue(proj.id, column.id, member.id);
    const createdLabel = await insertLabel();

    const result = await addIssueLabel({
      actor: actorFor(member),
      issueId: createdIssue.id,
      labelId: createdLabel.id,
    });

    expect(result).toEqual({ ok: true, applied: true });
    const rows = await testDb
      .select()
      .from(issueLabel)
      .where(and(eq(issueLabel.issueId, createdIssue.id), eq(issueLabel.labelId, createdLabel.id)));
    expect(rows).toHaveLength(1);
  });

  it("refuses a non-member", async () => {
    const { proj, column } = await insertProjectWithColumn();
    const member = await insertUser();
    const outsider = await insertUser({ email: `outsider-${crypto.randomUUID()}@example.com` });
    await addMember(proj.id, member.id);
    const createdIssue = await insertIssue(proj.id, column.id, member.id);
    const createdLabel = await insertLabel();

    const result = await addIssueLabel({
      actor: actorFor(outsider),
      issueId: createdIssue.id,
      labelId: createdLabel.id,
    });

    expect(result.ok).toBe(false);
    const rows = await testDb.select().from(issueLabel);
    expect(rows).toHaveLength(0);
  });

  it("derives membership from the issue's own stored project, refusing a member of a different project", async () => {
    const { proj: ownProject, column } = await insertProjectWithColumn();
    const { proj: otherProject } = await insertProjectWithColumn();
    const owner = await insertUser();
    const otherMember = await insertUser({ email: `other-${crypto.randomUUID()}@example.com` });
    await addMember(ownProject.id, owner.id);
    await addMember(otherProject.id, otherMember.id);
    const createdIssue = await insertIssue(ownProject.id, column.id, owner.id);
    const createdLabel = await insertLabel();

    const result = await addIssueLabel({
      actor: actorFor(otherMember),
      issueId: createdIssue.id,
      labelId: createdLabel.id,
    });

    expect(result.ok).toBe(false);
  });

  it("adding a label already present is a no-op, still ok: true, applied: true, no duplicate row", async () => {
    const { proj, column } = await insertProjectWithColumn();
    const member = await insertUser();
    await addMember(proj.id, member.id);
    const createdIssue = await insertIssue(proj.id, column.id, member.id);
    const createdLabel = await insertLabel();
    await testDb.insert(issueLabel).values({ issueId: createdIssue.id, labelId: createdLabel.id });

    const result = await addIssueLabel({
      actor: actorFor(member),
      issueId: createdIssue.id,
      labelId: createdLabel.id,
    });

    expect(result).toEqual({ ok: true, applied: true });
    const rows = await testDb.select().from(issueLabel);
    expect(rows).toHaveLength(1);
  });

  it("an unknown labelId is refused by name rather than thrown", async () => {
    const { proj, column } = await insertProjectWithColumn();
    const member = await insertUser();
    await addMember(proj.id, member.id);
    const createdIssue = await insertIssue(proj.id, column.id, member.id);

    const result = await addIssueLabel({
      actor: actorFor(member),
      issueId: createdIssue.id,
      labelId: crypto.randomUUID(),
    });

    expect(result).toEqual({ ok: false, error: "label_not_found" });
  });

  it("an unknown issueId is refused rather than thrown", async () => {
    const member = await insertUser();
    const createdLabel = await insertLabel();

    const result = await addIssueLabel({
      actor: actorFor(member),
      issueId: crypto.randomUUID(),
      labelId: createdLabel.id,
    });

    expect(result).toEqual({ ok: false, error: "not_found" });
  });
});

describe("removeIssueLabel — authorization and idempotency (FR-019, FR-020, FR-022, research C-5)", () => {
  it("a member removes a label the issue carries", async () => {
    const { proj, column } = await insertProjectWithColumn();
    const member = await insertUser();
    await addMember(proj.id, member.id);
    const createdIssue = await insertIssue(proj.id, column.id, member.id);
    const createdLabel = await insertLabel();
    await testDb.insert(issueLabel).values({ issueId: createdIssue.id, labelId: createdLabel.id });

    const result = await removeIssueLabel({
      actor: actorFor(member),
      issueId: createdIssue.id,
      labelId: createdLabel.id,
    });

    expect(result).toEqual({ ok: true, applied: false });
    const rows = await testDb.select().from(issueLabel);
    expect(rows).toHaveLength(0);
  });

  it("refuses a non-member, leaving the row untouched", async () => {
    const { proj, column } = await insertProjectWithColumn();
    const member = await insertUser();
    const outsider = await insertUser({ email: `outsider-${crypto.randomUUID()}@example.com` });
    await addMember(proj.id, member.id);
    const createdIssue = await insertIssue(proj.id, column.id, member.id);
    const createdLabel = await insertLabel();
    await testDb.insert(issueLabel).values({ issueId: createdIssue.id, labelId: createdLabel.id });

    const result = await removeIssueLabel({
      actor: actorFor(outsider),
      issueId: createdIssue.id,
      labelId: createdLabel.id,
    });

    expect(result.ok).toBe(false);
    const rows = await testDb.select().from(issueLabel);
    expect(rows).toHaveLength(1);
  });

  it("removing a label not present is a no-op, matches zero rows without raising", async () => {
    const { proj, column } = await insertProjectWithColumn();
    const member = await insertUser();
    await addMember(proj.id, member.id);
    const createdIssue = await insertIssue(proj.id, column.id, member.id);
    const createdLabel = await insertLabel();

    const result = await removeIssueLabel({
      actor: actorFor(member),
      issueId: createdIssue.id,
      labelId: createdLabel.id,
    });

    expect(result).toEqual({ ok: true, applied: false });
  });

  it("an unknown labelId is refused by name rather than thrown", async () => {
    const { proj, column } = await insertProjectWithColumn();
    const member = await insertUser();
    await addMember(proj.id, member.id);
    const createdIssue = await insertIssue(proj.id, column.id, member.id);

    const result = await removeIssueLabel({
      actor: actorFor(member),
      issueId: createdIssue.id,
      labelId: crypto.randomUUID(),
    });

    expect(result).toEqual({ ok: false, error: "label_not_found" });
  });
});