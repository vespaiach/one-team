import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { activity, project, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { setProjectStatus } from "./project-status";

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

describe("setProjectStatus — activity (FR-052, FR-054)", () => {
  it("archiving writes one archived row with no field/from/to, in the same transaction as the status change", async () => {
    const proj = await insertProject({ status: "active" });
    const admin = await insertUser({ role: "admin" });

    await setProjectStatus(proj.id, "archived", admin.id);

    const rows = await testDb.select().from(activity).where(eq(activity.projectId, proj.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: "archived",
      actorId: admin.id,
      field: null,
      fromValue: null,
      toValue: null,
    });
    const [row] = await testDb.select().from(project).where(eq(project.id, proj.id));
    expect(row?.status).toBe("archived");
  });

  it("reopening writes one reopened row with no field/from/to, in the same transaction as the status change", async () => {
    const proj = await insertProject({ status: "archived" });
    const admin = await insertUser({ role: "admin" });

    await setProjectStatus(proj.id, "active", admin.id);

    const rows = await testDb.select().from(activity).where(eq(activity.projectId, proj.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: "reopened",
      actorId: admin.id,
      field: null,
      fromValue: null,
      toValue: null,
    });
    const [row] = await testDb.select().from(project).where(eq(project.id, proj.id));
    expect(row?.status).toBe("active");
  });

  it("a call carrying no actorId writes no row and still changes the status exactly as before", async () => {
    const proj = await insertProject({ status: "active" });

    await setProjectStatus(proj.id, "archived");

    const rows = await testDb.select().from(activity).where(eq(activity.projectId, proj.id));
    expect(rows).toHaveLength(0);
    const [row] = await testDb.select().from(project).where(eq(project.id, proj.id));
    expect(row?.status).toBe("archived");
  });
});