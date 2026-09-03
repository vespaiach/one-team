import { beforeEach, describe, expect, it } from "vitest";
import { project, projectMember, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { findProjectKeyHolder, hasProjectMemberRow, listAddableUsers, loadProjectByKey } from "./queries";

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

describe("findProjectKeyHolder (FR-026, OT-UX-012)", () => {
  it("returns the holder's key and name for a key that is taken", async () => {
    await insertProject({ key: "WR", name: "Website Redesign" });

    await expect(findProjectKeyHolder("WR")).resolves.toEqual({ key: "WR", name: "Website Redesign" });
  });

  it("returns null for a key that matches no project", async () => {
    await expect(findProjectKeyHolder("NOPE")).resolves.toBeNull();
  });
});

describe("listAddableUsers (FR-030, FR-045, OT-AUTHZ-006)", () => {
  it("excludes deactivated accounts", async () => {
    const active = await insertUser({ firstName: "Ada", lastName: "Lovelace" });
    await insertUser({ firstName: "Bea", lastName: "Closed", deactivatedAt: new Date() });

    const rows = await listAddableUsers({});

    expect(rows.map((row) => row.userId)).toEqual([active.id]);
  });

  it("excludes the named user", async () => {
    const kept = await insertUser({ firstName: "Ada", lastName: "Lovelace" });
    const excluded = await insertUser({ firstName: "Bea", lastName: "Excluded" });

    const rows = await listAddableUsers({ excludeUserId: excluded.id });

    expect(rows.map((row) => row.userId)).toEqual([kept.id]);
  });

  it("excludes existing members of the named project", async () => {
    const proj = await insertProject();
    const member = await insertUser({ firstName: "Ada", lastName: "Lovelace" });
    const nonMember = await insertUser({ firstName: "Bea", lastName: "Free" });
    await addMember(proj.id, member.id);

    const rows = await listAddableUsers({ excludeProjectId: proj.id });

    expect(rows.map((row) => row.userId)).toEqual([nonMember.id]);
  });

  it("orders by lower(last_name), lower(first_name)", async () => {
    const zed = await insertUser({ firstName: "Zed", lastName: "Adams" });
    const amy = await insertUser({ firstName: "Amy", lastName: "adams" });
    const bea = await insertUser({ firstName: "Bea", lastName: "Baker" });

    const rows = await listAddableUsers({});

    expect(rows.map((row) => row.userId)).toEqual([amy.id, zed.id, bea.id]);
  });

  it("returns publicUser-shaped rows with deactivated always false", async () => {
    const account = await insertUser({
      firstName: "Ada",
      lastName: "Lovelace",
      jobTitle: "Engineer",
      avatarUrl: "https://example.com/a.png",
    });

    const rows = await listAddableUsers({});

    expect(rows).toEqual([
      {
        userId: account.id,
        displayName: "Ada Lovelace",
        avatarUrl: "https://example.com/a.png",
        jobTitle: "Engineer",
        deactivated: false,
      },
    ]);
  });
});