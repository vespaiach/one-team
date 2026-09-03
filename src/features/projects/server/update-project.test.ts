import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { project, projectMember, user } from "@/db/schema";
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

describe("updateProject (FR-014, FR-016, FR-028, FR-036)", () => {
  it("accepts a name change from a member", async () => {
    const proj = await insertProject();
    const member = await insertUser();
    await addMember(proj.id, member.id);

    const result = await updateProject(proj.id, member, { name: "Renamed" });

    expect(result).toEqual({ status: "saved" });
    const [row] = await testDb.select().from(project).where(eq(project.id, proj.id));
    expect(row?.name).toBe("Renamed");
  });

  it("accepts a description change", async () => {
    const proj = await insertProject();
    const member = await insertUser();
    await addMember(proj.id, member.id);

    const result = await updateProject(proj.id, member, { description: "New description" });

    expect(result).toEqual({ status: "saved" });
    const [row] = await testDb.select().from(project).where(eq(project.id, proj.id));
    expect(row?.description).toBe("New description");
  });

  it("accepts a start date change", async () => {
    const proj = await insertProject();
    const member = await insertUser();
    await addMember(proj.id, member.id);

    const result = await updateProject(proj.id, member, { startDate: "2026-01-01" });

    expect(result).toEqual({ status: "saved" });
    const [row] = await testDb.select().from(project).where(eq(project.id, proj.id));
    expect(row?.startDate).toBe("2026-01-01");
  });

  it("accepts a target date change", async () => {
    const proj = await insertProject();
    const member = await insertUser();
    await addMember(proj.id, member.id);

    const result = await updateProject(proj.id, member, { targetDate: "2026-12-31" });

    expect(result).toEqual({ status: "saved" });
    const [row] = await testDb.select().from(project).where(eq(project.id, proj.id));
    expect(row?.targetDate).toBe("2026-12-31");
  });

  it("ignores a key or status property present on the input at runtime", async () => {
    const proj = await insertProject({ key: "WR", status: "active" });
    const member = await insertUser();
    await addMember(proj.id, member.id);

    const changes = { name: "Renamed", key: "HACKED", status: "archived" } as Record<string, unknown>;
    const result = await updateProject(proj.id, member, changes);

    expect(result).toEqual({ status: "saved" });
    const [row] = await testDb.select().from(project).where(eq(project.id, proj.id));
    expect(row?.key).toBe("WR");
    expect(row?.status).toBe("active");
  });

  it("maps a 23514 on project_dates_ordered to a field-named refusal", async () => {
    const proj = await insertProject({ startDate: "2026-06-10" });
    const member = await insertUser();
    await addMember(proj.id, member.id);

    const result = await updateProject(proj.id, member, { targetDate: "2026-06-01" });

    expect(result).toEqual({ status: "invalid", field: "targetDate", reason: "before_start" });
    const [row] = await testDb.select().from(project).where(eq(project.id, proj.id));
    expect(row?.targetDate).toBeNull();
  });

  it("refuses a start date set later than an already-saved target, reading the stored row", async () => {
    const proj = await insertProject({ targetDate: "2026-06-01" });
    const member = await insertUser();
    await addMember(proj.id, member.id);

    const result = await updateProject(proj.id, member, { startDate: "2026-06-10" });

    expect(result).toEqual({ status: "invalid", field: "targetDate", reason: "before_start" });
    const [row] = await testDb.select().from(project).where(eq(project.id, proj.id));
    expect(row?.startDate).toBeNull();
  });

  it("refuses a non-member through the isMember check the writing transaction itself evaluates", async () => {
    const proj = await insertProject();
    const nonMember = await insertUser();

    const result = await updateProject(proj.id, nonMember, { name: "Renamed" });

    expect(result).toEqual({ status: "forbidden" });
    const [row] = await testDb.select().from(project).where(eq(project.id, proj.id));
    expect(row?.name).toBe("Website Redesign");
  });

  it("admits an admin who holds no membership row", async () => {
    const proj = await insertProject();
    const admin = await insertUser({ role: "admin" });

    const result = await updateProject(proj.id, admin, { name: "Renamed" });

    expect(result).toEqual({ status: "saved" });
  });

  it("returns not_found for a project id that resolves to no row", async () => {
    const member = await insertUser();

    const result = await updateProject(crypto.randomUUID(), member, { name: "Renamed" });

    expect(result).toEqual({ status: "not_found" });
  });

  it("still accepts a member's edit to an archived project", async () => {
    const proj = await insertProject({ status: "archived" });
    const member = await insertUser();
    await addMember(proj.id, member.id);

    const result = await updateProject(proj.id, member, { name: "Renamed" });

    expect(result).toEqual({ status: "saved" });
  });

  it("holds the membership guarantee when membership is removed concurrently with the update", async () => {
    const proj = await insertProject();
    const member = await insertUser();
    await addMember(proj.id, member.id);

    const [updateResult] = await Promise.all([
      updateProject(proj.id, member, { name: "Renamed" }),
      testDb.delete(projectMember).where(eq(projectMember.projectId, proj.id)),
    ]);

    expect(["saved", "forbidden"]).toContain(updateResult.status);
    const [row] = await testDb.select().from(project).where(eq(project.id, proj.id));
    if (updateResult.status === "saved") {
      expect(row?.name).toBe("Renamed");
    } else {
      expect(row?.name).toBe("Website Redesign");
    }
  });

  it("resolves two concurrent writes to one field as last-write-wins, with neither refused", async () => {
    const proj = await insertProject();
    const member = await insertUser();
    await addMember(proj.id, member.id);

    const [first, second] = await Promise.all([
      updateProject(proj.id, member, { name: "First" }),
      updateProject(proj.id, member, { name: "Second" }),
    ]);

    expect(first.status).toBe("saved");
    expect(second.status).toBe("saved");
    const [row] = await testDb.select().from(project).where(eq(project.id, proj.id));
    expect(["First", "Second"]).toContain(row?.name);
  });
});