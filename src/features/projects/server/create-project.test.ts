import { asc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { boardColumn, issueCounter, project, projectMember, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { createProject } from "./create-project";

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

function baseInput(overrides: Partial<Parameters<typeof createProject>[0]> = {}) {
  return {
    name: "Website Redesign",
    key: "WR",
    description: null,
    startDate: null,
    targetDate: null,
    memberIds: [] as string[],
    ...overrides,
  };
}

describe("createProject (FR-034)", () => {
  it("writes 1 project + 5 columns + 1 counter seeded at 0 + n memberships in one transaction", async () => {
    const member1 = await insertUser({ firstName: "Grace", lastName: "Hopper" });
    const member2 = await insertUser({ firstName: "Alan", lastName: "Turing" });

    const result = await createProject(baseInput({ memberIds: [member1.id, member2.id] }));

    expect(result).toEqual({ status: "created", projectKey: "WR" });

    const [createdProject] = await testDb.select().from(project).where(eq(project.key, "WR"));
    expect(createdProject).toBeDefined();
    if (!createdProject) throw new Error("unreachable");

    const columns = await testDb
      .select()
      .from(boardColumn)
      .where(eq(boardColumn.projectId, createdProject.id))
      .orderBy(asc(boardColumn.sortOrder));
    expect(columns).toHaveLength(5);
    expect(columns.map((column) => column.name)).toEqual([
      "Backlog",
      "Todo",
      "In Progress",
      "Done",
      "Canceled",
    ]);

    const [counter] = await testDb
      .select()
      .from(issueCounter)
      .where(eq(issueCounter.projectId, createdProject.id));
    expect(counter?.lastNumber).toBe(0);

    const memberships = await testDb
      .select()
      .from(projectMember)
      .where(eq(projectMember.projectId, createdProject.id));
    expect(memberships.map((row) => row.userId).sort()).toEqual([member1.id, member2.id].sort());
  });

  it("the creating admin is never among the written memberships when not passed in memberIds", async () => {
    const admin = await insertUser({ role: "admin" });
    const member = await insertUser({ firstName: "Grace", lastName: "Hopper" });

    await createProject(baseInput({ key: "OTHR", memberIds: [member.id] }));

    const [createdProject] = await testDb.select().from(project).where(eq(project.key, "OTHR"));
    if (!createdProject) throw new Error("unreachable");
    const memberships = await testDb
      .select()
      .from(projectMember)
      .where(eq(projectMember.projectId, createdProject.id));
    expect(memberships.map((row) => row.userId)).not.toContain(admin.id);
  });

  it("maps a 23505 on the key constraint to key_taken, naming the holder, applying no suffix", async () => {
    await createProject(baseInput({ key: "WR", name: "Website Redesign" }));

    const result = await createProject(baseInput({ key: "WR", name: "A Second Attempt" }));

    expect(result).toEqual({ status: "key_taken", holder: { key: "WR", name: "Website Redesign" } });
  });

  it("refuses a target date before the start date through the table CHECK", async () => {
    await expect(
      createProject(baseInput({ startDate: "2026-06-10", targetDate: "2026-06-01" })),
    ).rejects.toMatchObject({ cause: { code: "23514" } });
  });

  it("still writes a membership row for a member id whose account was deactivated before submission", async () => {
    const member = await insertUser({ firstName: "Grace", lastName: "Hopper", deactivatedAt: new Date() });

    const result = await createProject(baseInput({ memberIds: [member.id] }));

    expect(result.status).toBe("created");
    const [createdProject] = await testDb.select().from(project).where(eq(project.key, "WR"));
    if (!createdProject) throw new Error("unreachable");
    const memberships = await testDb
      .select()
      .from(projectMember)
      .where(eq(projectMember.projectId, createdProject.id));
    expect(memberships.map((row) => row.userId)).toEqual([member.id]);
  });

  it("resolves two concurrent creations of one key with exactly one success", async () => {
    const [first, second] = await Promise.allSettled([
      createProject(baseInput({ key: "WR", name: "First" })),
      createProject(baseInput({ key: "WR", name: "Second" })),
    ]);

    const results = [first, second].map((settled) => (settled.status === "fulfilled" ? settled.value : null));

    const created = results.filter((result) => result?.status === "created");
    const taken = results.filter((result) => result?.status === "key_taken");

    expect(created).toHaveLength(1);
    expect(taken).toHaveLength(1);
  });
});