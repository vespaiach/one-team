import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { project, projectMember, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { isMember } from "./authorization";
import { addProjectMember, removeProjectMember } from "./membership";

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

describe("addProjectMember and removeProjectMember (FR-019, FR-045, US3)", () => {
  it("addProjectMember writes one row", async () => {
    const proj = await insertProject();
    const member = await insertUser();

    await addProjectMember(proj.id, member.id);

    const rows = await testDb.select().from(projectMember).where(eq(projectMember.projectId, proj.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.userId).toBe(member.id);
  });

  it("removeProjectMember deletes one row and nothing else", async () => {
    const proj = await insertProject();
    const memberA = await insertUser({ firstName: "Grace", lastName: "Hopper" });
    const memberB = await insertUser({ firstName: "Alan", lastName: "Turing" });
    await addProjectMember(proj.id, memberA.id);
    await addProjectMember(proj.id, memberB.id);

    await removeProjectMember(proj.id, memberA.id);

    const rows = await testDb.select().from(projectMember).where(eq(projectMember.projectId, proj.id));
    expect(rows.map((row) => row.userId)).toEqual([memberB.id]);
  });

  it("removes the roster's last remaining row with no guardrail", async () => {
    const proj = await insertProject();
    const member = await insertUser();
    await addProjectMember(proj.id, member.id);

    await removeProjectMember(proj.id, member.id);

    const rows = await testDb.select().from(projectMember).where(eq(projectMember.projectId, proj.id));
    expect(rows).toHaveLength(0);
  });

  it("admits an admin who was never added explicitly", async () => {
    const proj = await insertProject();
    const admin = await insertUser({ role: "admin" });

    await expect(
      isMember(
        {
          id: admin.id,
          role: "admin",
          firstName: "Ada",
          lastName: "Lovelace",
          avatarUrl: null,
          mustChangePassword: false,
        },
        proj.id,
      ),
    ).resolves.toBe(true);
  });

  it("admits an admin who was added and then removed", async () => {
    const proj = await insertProject();
    const admin = await insertUser({ role: "admin" });
    await addProjectMember(proj.id, admin.id);

    await removeProjectMember(proj.id, admin.id);

    await expect(
      isMember(
        {
          id: admin.id,
          role: "admin",
          firstName: "Ada",
          lastName: "Lovelace",
          avatarUrl: null,
          mustChangePassword: false,
        },
        proj.id,
      ),
    ).resolves.toBe(true);
  });
});