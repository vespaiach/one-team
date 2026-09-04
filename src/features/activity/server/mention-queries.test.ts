import { beforeEach, describe, expect, it } from "vitest";
import { boardColumn, issue, project, projectMember, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { listMentionCandidates } from "./mention-queries";

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

async function insertProject(overrides: Partial<typeof project.$inferInsert> = {}) {
  const now = new Date();
  const [row] = await testDb
    .insert(project)
    .values({
      key: `P${crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      name: "Website Redesign",
      createdAt: now,
      updatedAt: now,
      ...overrides,
    })
    .returning();
  if (!row) {
    throw new Error("insertProject produced no row");
  }
  return row;
}

async function insertColumn(projectId: string, overrides: Partial<typeof boardColumn.$inferInsert> = {}) {
  const now = new Date();
  const [row] = await testDb
    .insert(boardColumn)
    .values({
      projectId,
      name: "Backlog",
      kind: "open",
      sortOrder: "a0",
      createdAt: now,
      updatedAt: now,
      ...overrides,
    })
    .returning();
  if (!row) {
    throw new Error("insertColumn produced no row");
  }
  return row;
}

async function insertIssue(
  projectId: string,
  columnId: string,
  createdBy: string,
  overrides: Partial<typeof issue.$inferInsert> = {},
) {
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
      ...overrides,
    })
    .returning();
  if (!row) {
    throw new Error("insertIssue produced no row");
  }
  return row;
}

async function addMember(projectId: string, userId: string) {
  const now = new Date();
  await testDb.insert(projectMember).values({ projectId, userId, createdAt: now, updatedAt: now });
}

describe("listMentionCandidates — ranking (FR-024, research E-2)", () => {
  it("ranks a project member above an unrelated signed-in user, for a project target", async () => {
    const proj = await insertProject();
    const member = await insertUser({ firstName: "Grace", lastName: "Hopper" });
    await addMember(proj.id, member.id);
    const unrelated = await insertUser({ firstName: "Zoe", lastName: "Zephyr" });

    const { scoped, everyoneElse } = await listMentionCandidates({ projectId: proj.id });

    expect(scoped.map((entry) => entry.id)).toEqual([member.id]);
    expect(everyoneElse.map((entry) => entry.id)).toEqual([unrelated.id]);
  });

  it("ranks that issue's own project's member above an unrelated user, for an issue target", async () => {
    const proj = await insertProject();
    const column = await insertColumn(proj.id);
    const member = await insertUser({ firstName: "Grace", lastName: "Hopper" });
    await addMember(proj.id, member.id);
    const issueRow = await insertIssue(proj.id, column.id, member.id);
    const unrelated = await insertUser({ firstName: "Zoe", lastName: "Zephyr" });

    const { scoped, everyoneElse } = await listMentionCandidates({ issueId: issueRow.id });

    expect(scoped.map((entry) => entry.id)).toEqual([member.id]);
    expect(everyoneElse.map((entry) => entry.id)).toEqual([unrelated.id]);
  });

  it("ranks every admin in scoped, even one holding no membership row", async () => {
    const proj = await insertProject();
    const admin = await insertUser({ firstName: "Alan", lastName: "Turing", role: "admin" });
    const unrelated = await insertUser({ firstName: "Zoe", lastName: "Zephyr" });

    const { scoped, everyoneElse } = await listMentionCandidates({ projectId: proj.id });

    expect(scoped.map((entry) => entry.id)).toEqual([admin.id]);
    expect(everyoneElse.map((entry) => entry.id)).toEqual([unrelated.id]);
  });

  it("alphabetizes each group by last name then first name", async () => {
    const proj = await insertProject();
    const hopper = await insertUser({ firstName: "Grace", lastName: "Hopper" });
    const lovelace = await insertUser({ firstName: "Ada", lastName: "Lovelace" });
    await addMember(proj.id, hopper.id);
    await addMember(proj.id, lovelace.id);
    const wozniak = await insertUser({ firstName: "Steve", lastName: "Wozniak" });
    const jobs = await insertUser({ firstName: "Steve", lastName: "Jobs" });

    const { scoped, everyoneElse } = await listMentionCandidates({ projectId: proj.id });

    expect(scoped.map((entry) => entry.id)).toEqual([hopper.id, lovelace.id]);
    expect(everyoneElse.map((entry) => entry.id)).toEqual([jobs.id, wozniak.id]);
  });

  it("excludes a deactivated account unconditionally, whether scoped or not", async () => {
    const proj = await insertProject();
    const deactivatedMember = await insertUser({
      firstName: "Retired",
      lastName: "Member",
      deactivatedAt: new Date(),
    });
    await addMember(proj.id, deactivatedMember.id);
    const deactivatedAdmin = await insertUser({
      firstName: "Retired",
      lastName: "Admin",
      role: "admin",
      deactivatedAt: new Date(),
    });
    const deactivatedOutsider = await insertUser({
      firstName: "Retired",
      lastName: "Outsider",
      deactivatedAt: new Date(),
    });

    const { scoped, everyoneElse } = await listMentionCandidates({ projectId: proj.id });

    const allIds = [...scoped, ...everyoneElse].map((entry) => entry.id);
    expect(allIds).not.toContain(deactivatedMember.id);
    expect(allIds).not.toContain(deactivatedAdmin.id);
    expect(allIds).not.toContain(deactivatedOutsider.id);
  });

  it("offers every admin and every other signed-in user, admins scoped, when the project holds no other members", async () => {
    const proj = await insertProject();
    const admin = await insertUser({ firstName: "Alan", lastName: "Turing", role: "admin" });
    const outsider = await insertUser({ firstName: "Zoe", lastName: "Zephyr" });

    const { scoped, everyoneElse } = await listMentionCandidates({ projectId: proj.id });

    expect(scoped.map((entry) => entry.id)).toEqual([admin.id]);
    expect(everyoneElse.map((entry) => entry.id)).toEqual([outsider.id]);
  });

  it("is re-read live: a membership added between two calls appears in scoped on the very next one", async () => {
    const proj = await insertProject();
    const soonToBeMember = await insertUser({ firstName: "Grace", lastName: "Hopper" });

    const before = await listMentionCandidates({ projectId: proj.id });
    expect(before.scoped.map((entry) => entry.id)).not.toContain(soonToBeMember.id);

    await addMember(proj.id, soonToBeMember.id);

    const after = await listMentionCandidates({ projectId: proj.id });
    expect(after.scoped.map((entry) => entry.id)).toContain(soonToBeMember.id);
  });
});