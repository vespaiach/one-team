import { beforeEach, describe, expect, it } from "vitest";
import { project, projectMember, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { hasProjectMemberRow, loadProjectByKey } from "./queries";

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

async function addMember(projectId: string, userId: string) {
  const now = new Date();
  await testDb.insert(projectMember).values({ projectId, userId, createdAt: now, updatedAt: now });
}

describe("hasProjectMemberRow (FR-013, OT-AUTHZ-001)", () => {
  it("returns true when the pair holds a membership row", async () => {
    const proj = await insertProject();
    const member = await insertUser();
    await addMember(proj.id, member.id);

    await expect(hasProjectMemberRow(proj.id, member.id)).resolves.toBe(true);
  });

  it("returns false when the user holds no row in that project", async () => {
    const proj = await insertProject();
    const nonMember = await insertUser();

    await expect(hasProjectMemberRow(proj.id, nonMember.id)).resolves.toBe(false);
  });

  it("returns false when the user is a member of a different project", async () => {
    const proj = await insertProject();
    const otherProject = await insertProject({ key: "OTHR" });
    const member = await insertUser();
    await addMember(otherProject.id, member.id);

    await expect(hasProjectMemberRow(proj.id, member.id)).resolves.toBe(false);
  });
});

describe("loadProjectByKey (FR-035, FR-040)", () => {
  it("returns the project row for a matching key", async () => {
    const proj = await insertProject({ key: "WR" });

    const found = await loadProjectByKey("WR");

    expect(found?.id).toBe(proj.id);
    expect(found?.name).toBe("Website Redesign");
  });

  it("returns null for a key that matches nothing", async () => {
    await expect(loadProjectByKey("NOPE")).resolves.toBeNull();
  });
});