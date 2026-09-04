import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { activity, project, user } from "@/db/schema";
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
    key: `P${crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`,
    description: null,
    startDate: null,
    targetDate: null,
    memberIds: [] as string[],
    ...overrides,
  };
}

describe("createProject — activity (FR-050, FR-054, research D-1)", () => {
  it("writes one created row naming the actor and one member_added row per seeded member, in the transaction", async () => {
    const admin = await insertUser({ role: "admin" });
    const member1 = await insertUser({ firstName: "Grace", lastName: "Hopper" });
    const member2 = await insertUser({ firstName: "Alan", lastName: "Turing" });

    const result = await createProject(baseInput({ memberIds: [member1.id, member2.id], actorId: admin.id }));

    expect(result.status).toBe("created");
    const [createdProject] = await testDb
      .select()
      .from(project)
      .where(eq(project.key, result.status === "created" ? result.projectKey : ""));
    if (!createdProject) throw new Error("unreachable");

    const rows = await testDb.select().from(activity).where(eq(activity.projectId, createdProject.id));
    expect(rows).toHaveLength(3);

    const createdRow = rows.find((row) => row.type === "created");
    expect(createdRow).toMatchObject({ actorId: admin.id, field: null, fromValue: null, toValue: null });

    const memberAddedRows = rows.filter((row) => row.type === "member_added");
    expect(memberAddedRows).toHaveLength(2);
    expect(memberAddedRows.map((row) => row.toValue).sort()).toEqual(["Grace Hopper", "Alan Turing"].sort());
    for (const row of memberAddedRows) {
      expect(row.actorId).toBe(admin.id);
      expect(row.fromValue).toBeNull();
    }
  });

  it("writes no field_changed row for any value set at creation", async () => {
    const admin = await insertUser({ role: "admin" });

    const result = await createProject(
      baseInput({ description: "A fresh project", startDate: "2026-01-01", actorId: admin.id }),
    );

    expect(result.status).toBe("created");
    const [createdProject] = await testDb
      .select()
      .from(project)
      .where(eq(project.key, result.status === "created" ? result.projectKey : ""));
    if (!createdProject) throw new Error("unreachable");
    const rows = await testDb.select().from(activity).where(eq(activity.projectId, createdProject.id));
    expect(rows.every((row) => row.type !== "field_changed")).toBe(true);
  });

  it("a call carrying no actorId writes no activity row and still creates the project exactly as before", async () => {
    const member = await insertUser({ firstName: "Grace", lastName: "Hopper" });

    const result = await createProject(baseInput({ memberIds: [member.id] }));

    expect(result.status).toBe("created");
    const [createdProject] = await testDb
      .select()
      .from(project)
      .where(eq(project.key, result.status === "created" ? result.projectKey : ""));
    if (!createdProject) throw new Error("unreachable");
    const rows = await testDb.select().from(activity).where(eq(activity.projectId, createdProject.id));
    expect(rows).toHaveLength(0);
  });
});