import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { activity, project, projectMember, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
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

describe("addProjectMember and removeProjectMember — activity (FR-053, research D-4)", () => {
  it("addProjectMember writes one member_added row carrying the added user's display name in to_value", async () => {
    const proj = await insertProject();
    const admin = await insertUser({ role: "admin" });
    const member = await insertUser({ firstName: "Grace", lastName: "Hopper" });

    await addProjectMember(proj.id, member.id, admin.id);

    const rows = await testDb.select().from(activity).where(eq(activity.projectId, proj.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: "member_added",
      actorId: admin.id,
      fromValue: null,
      toValue: "Grace Hopper",
    });
    const membership = await testDb.select().from(projectMember).where(eq(projectMember.projectId, proj.id));
    expect(membership).toHaveLength(1);
  });

  it("removeProjectMember writes one member_removed row carrying the removed user's display name in from_value", async () => {
    const proj = await insertProject();
    const admin = await insertUser({ role: "admin" });
    const member = await insertUser({ firstName: "Grace", lastName: "Hopper" });
    await addProjectMember(proj.id, member.id);

    await removeProjectMember(proj.id, member.id, admin.id);

    const rows = await testDb.select().from(activity).where(eq(activity.projectId, proj.id));
    const removedRow = rows.find((row) => row.type === "member_removed");
    expect(removedRow).toMatchObject({
      actorId: admin.id,
      fromValue: "Grace Hopper",
      toValue: null,
    });
    const membership = await testDb.select().from(projectMember).where(eq(projectMember.projectId, proj.id));
    expect(membership).toHaveLength(0);
  });

  it("a call to either carrying no actorId writes no row and still changes the roster exactly as before", async () => {
    const proj = await insertProject();
    const member = await insertUser({ firstName: "Grace", lastName: "Hopper" });

    await addProjectMember(proj.id, member.id);
    await removeProjectMember(proj.id, member.id);

    const rows = await testDb.select().from(activity).where(eq(activity.projectId, proj.id));
    expect(rows).toHaveLength(0);
    const membership = await testDb.select().from(projectMember).where(eq(projectMember.projectId, proj.id));
    expect(membership).toHaveLength(0);
  });
});