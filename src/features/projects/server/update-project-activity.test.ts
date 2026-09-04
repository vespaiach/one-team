import { asc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { activity, project, projectMember, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { updateProject } from "./update-project";

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

describe("updateProject — activity (FR-051, SC-003, research D-2)", () => {
  it("writes one field_changed row for the one field named, naming the old and new values", async () => {
    const proj = await insertProject({ name: "Original" });
    const member = await insertUser();
    await addMember(proj.id, member.id);

    const result = await updateProject(proj.id, member, { name: "Renamed" });

    expect(result).toEqual({ status: "saved" });
    const rows = await testDb.select().from(activity).where(eq(activity.projectId, proj.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: "field_changed",
      actorId: member.id,
      field: "name",
      fromValue: "Original",
      toValue: "Renamed",
    });
  });

  it.each([
    ["description", "description", "New description"],
    ["startDate", "start_date", "2026-01-01"],
    ["targetDate", "target_date", "2026-12-31"],
  ] as const)("writes a field_changed row naming '%s' as '%s'", async (changeKey, fieldLiteral, newValue) => {
    const proj = await insertProject();
    const member = await insertUser();
    await addMember(proj.id, member.id);

    await updateProject(proj.id, member, { [changeKey]: newValue });

    const rows = await testDb.select().from(activity).where(eq(activity.projectId, proj.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: "field_changed", field: fieldLiteral, toValue: newValue });
  });

  it("writes two rows in one transaction when two fields differ", async () => {
    const proj = await insertProject({ name: "Original", description: "Old description" });
    const member = await insertUser();
    await addMember(proj.id, member.id);

    const result = await updateProject(proj.id, member, {
      name: "Renamed",
      description: "New description",
    });

    expect(result).toEqual({ status: "saved" });
    const rows = await testDb.select().from(activity).where(eq(activity.projectId, proj.id));
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.field).sort()).toEqual(["description", "name"]);
  });

  it("writes nothing when the named values all match the stored row", async () => {
    const proj = await insertProject({ name: "Original" });
    const member = await insertUser();
    await addMember(proj.id, member.id);

    const result = await updateProject(proj.id, member, { name: "Original" });

    expect(result).toEqual({ status: "saved" });
    const rows = await testDb.select().from(activity).where(eq(activity.projectId, proj.id));
    expect(rows).toHaveLength(0);
  });

  it("freezes a description change at 200 characters however long the field itself is (SC-004)", async () => {
    const proj = await insertProject({ description: "Old ".repeat(100) });
    const member = await insertUser();
    await addMember(proj.id, member.id);
    const longDescription = "New ".repeat(100);

    await updateProject(proj.id, member, { description: longDescription });

    const rows = await testDb.select().from(activity).where(eq(activity.projectId, proj.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.fromValue?.length).toBeLessThanOrEqual(200);
    expect(rows[0]?.toValue?.length).toBeLessThanOrEqual(200);
  });

  it("locks the stored row FOR UPDATE, so a concurrent update reads the committed value rather than a stale one", async () => {
    const proj = await insertProject({ name: "Original" });
    const member = await insertUser();
    await addMember(proj.id, member.id);

    const [first, second] = await Promise.all([
      updateProject(proj.id, member, { name: "First" }),
      updateProject(proj.id, member, { name: "Second" }),
    ]);

    expect(first.status).toBe("saved");
    expect(second.status).toBe("saved");

    const rows = await testDb
      .select()
      .from(activity)
      .where(eq(activity.projectId, proj.id))
      .orderBy(asc(activity.createdAt), asc(activity.id));
    expect(rows).toHaveLength(2);
    expect(rows[0]?.fromValue).toBe("Original");
    expect(rows[1]?.fromValue).toBe(rows[0]?.toValue);
  });
});