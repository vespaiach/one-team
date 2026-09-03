import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { boardColumn, project, projectMember, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { listAssigneePool, listProjectColumns } from "./issue-queries";

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

async function insertColumn(overrides: Partial<typeof boardColumn.$inferInsert> & { projectId: string }) {
  const now = new Date();
  const [row] = await testDb
    .insert(boardColumn)
    .values({
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

async function addMember(projectId: string, userId: string) {
  const now = new Date();
  await testDb.insert(projectMember).values({ projectId, userId, createdAt: now, updatedAt: now });
}

describe("listProjectColumns (FR-032, FR-052)", () => {
  it("returns the project's columns in board order", async () => {
    const proj = await insertProject();
    await insertColumn({ projectId: proj.id, name: "Done", kind: "done", sortOrder: "a3" });
    await insertColumn({ projectId: proj.id, name: "Backlog", kind: "open", sortOrder: "a0" });
    await insertColumn({ projectId: proj.id, name: "Todo", kind: "open", sortOrder: "a1" });

    const columns = await listProjectColumns(proj.id);

    expect(columns.map((column) => column.name)).toEqual(["Backlog", "Todo", "Done"]);
  });

  it("returns no columns from another project", async () => {
    const proj = await insertProject();
    const other = await insertProject({
      key: `P${crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`,
    });
    await insertColumn({ projectId: other.id });

    const columns = await listProjectColumns(proj.id);

    expect(columns).toEqual([]);
  });
});

describe("listAssigneePool (FR-022, FR-024, FR-032, OT-AUTHZ-007)", () => {
  it("includes project_member rows for this project", async () => {
    const proj = await insertProject();
    const member = await insertUser({ firstName: "Grace", lastName: "Hopper" });
    await addMember(proj.id, member.id);

    const pool = await listAssigneePool(proj.id);

    expect(pool.map((entry) => entry.id)).toContain(member.id);
  });

  it("includes every admin, even one holding no membership row in this project", async () => {
    const proj = await insertProject();
    const admin = await insertUser({ firstName: "Alan", lastName: "Turing", role: "admin" });

    const pool = await listAssigneePool(proj.id);

    expect(pool.map((entry) => entry.id)).toContain(admin.id);
  });

  it("excludes a deactivated user, whether a member or an admin", async () => {
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

    const pool = await listAssigneePool(proj.id);

    expect(pool.map((entry) => entry.id)).not.toContain(deactivatedMember.id);
    expect(pool.map((entry) => entry.id)).not.toContain(deactivatedAdmin.id);
  });

  it("excludes a member of a different project who holds no membership row here", async () => {
    const proj = await insertProject();
    const other = await insertProject({
      key: `P${crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`,
    });
    const otherMember = await insertUser({ firstName: "Not", lastName: "Here" });
    await addMember(other.id, otherMember.id);

    const pool = await listAssigneePool(proj.id);

    expect(pool.map((entry) => entry.id)).not.toContain(otherMember.id);
  });

  it("does not duplicate an admin who also holds a membership row", async () => {
    const proj = await insertProject();
    const adminMember = await insertUser({ firstName: "Both", lastName: "Roles", role: "admin" });
    await addMember(proj.id, adminMember.id);

    const pool = await listAssigneePool(proj.id);

    expect(pool.filter((entry) => entry.id === adminMember.id)).toHaveLength(1);
  });

  it("returns users through the publicUser projection, carrying no contact fields", async () => {
    const proj = await insertProject();
    const member = await insertUser({ firstName: "Grace", lastName: "Hopper" });
    await addMember(proj.id, member.id);

    const pool = await listAssigneePool(proj.id);
    const entry = pool.find((candidate) => candidate.id === member.id);

    expect(entry).toMatchObject({ firstName: "Grace", lastName: "Hopper" });
    expect(entry).not.toHaveProperty("email");
  });
});

describe("a removed member is no longer offered as a candidate assignee (edge case)", () => {
  it("stops appearing in the pool once their membership row is removed", async () => {
    const proj = await insertProject();
    const removed = await insertUser({ firstName: "Once", lastName: "Member" });
    await addMember(proj.id, removed.id);

    expect((await listAssigneePool(proj.id)).map((entry) => entry.id)).toContain(removed.id);

    await testDb.delete(projectMember).where(eq(projectMember.userId, removed.id));

    expect((await listAssigneePool(proj.id)).map((entry) => entry.id)).not.toContain(removed.id);
  });
});