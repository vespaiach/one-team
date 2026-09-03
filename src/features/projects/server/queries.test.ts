import { beforeEach, describe, expect, it } from "vitest";
import { boardColumn, project, projectMember, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { SEED_COLUMNS } from "../seed-columns";
import {
  findProjectKeyHolder,
  hasProjectMemberRow,
  listAddableUsers,
  listProjectsForSidebar,
  loadProjectByKey,
  loadProjectDetails,
} from "./queries";

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

async function insertSeedColumns(projectId: string) {
  const now = new Date();
  await testDb.insert(boardColumn).values(
    SEED_COLUMNS.map((column) => ({
      projectId,
      name: column.name,
      kind: column.kind,
      sortOrder: column.sortOrder,
      createdAt: now,
      updatedAt: now,
    })),
  );
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

describe("loadProjectDetails (FR-035, FR-044, FR-045, FR-048)", () => {
  it("returns null for a key that matches no project", async () => {
    const admin = await insertUser({ role: "admin" });

    await expect(loadProjectDetails("NOPE", admin)).resolves.toBeNull();
  });

  it("returns the record", async () => {
    const admin = await insertUser({ role: "admin" });
    await insertProject({
      key: "WR",
      name: "Website Redesign",
      description: "A redesign",
      status: "archived",
      startDate: "2026-01-01",
      targetDate: "2026-06-01",
    });

    const details = await loadProjectDetails("WR", admin);

    expect(details?.record).toEqual({
      key: "WR",
      name: "Website Redesign",
      description: "A redesign",
      status: "archived",
      startDate: "2026-01-01",
      targetDate: "2026-06-01",
    });
  });

  it("returns the columns ordered by sort_order", async () => {
    const admin = await insertUser({ role: "admin" });
    const proj = await insertProject({ key: "WR" });
    await insertSeedColumns(proj.id);

    const details = await loadProjectDetails("WR", admin);

    expect(details?.columns.map((column) => column.name)).toEqual([
      "Backlog",
      "Todo",
      "In Progress",
      "Done",
      "Canceled",
    ]);
    expect(details?.columns.every((column) => column.issueCount === 0)).toBe(true);
  });

  it("returns the roster ordered by lower(last_name), lower(first_name), reading project_member rows only", async () => {
    const admin = await insertUser({ role: "admin" });
    const proj = await insertProject({ key: "WR" });
    const zed = await insertUser({ firstName: "Zed", lastName: "Adams" });
    const amy = await insertUser({ firstName: "Amy", lastName: "adams" });
    await addMember(proj.id, zed.id);
    await addMember(proj.id, amy.id);

    const details = await loadProjectDetails("WR", admin);

    expect(details?.roster.map((entry) => entry.userId)).toEqual([amy.id, zed.id]);
    expect(details?.roster.map((entry) => entry.userId)).not.toContain(admin.id);
  });

  it("keeps a deactivated member's roster row, flagged deactivated", async () => {
    const admin = await insertUser({ role: "admin" });
    const proj = await insertProject({ key: "WR" });
    const member = await insertUser({
      firstName: "Grace",
      lastName: "Hopper",
      deactivatedAt: new Date(),
    });
    await addMember(proj.id, member.id);

    const details = await loadProjectDetails("WR", admin);

    expect(details?.roster).toEqual([expect.objectContaining({ userId: member.id, deactivated: true })]);
  });

  it("returns the cascade count as columns plus memberships", async () => {
    const admin = await insertUser({ role: "admin" });
    const proj = await insertProject({ key: "WR" });
    await insertSeedColumns(proj.id);
    const member = await insertUser({ firstName: "Grace", lastName: "Hopper" });
    await addMember(proj.id, member.id);

    const details = await loadProjectDetails("WR", admin);

    expect(details?.cascadeCount).toBe(6);
  });

  it("admits an admin who holds no membership row, but does not admit a non-member", async () => {
    const admin = await insertUser({ role: "admin" });
    const nonMember = await insertUser({ role: "member" });
    await insertProject({ key: "WR" });

    const forAdmin = await loadProjectDetails("WR", admin);
    const forNonMember = await loadProjectDetails("WR", nonMember);

    expect(forAdmin?.canEditRecord).toBe(true);
    expect(forAdmin?.canAdminister).toBe(true);
    expect(forNonMember?.canEditRecord).toBe(false);
    expect(forNonMember?.canAdminister).toBe(false);
  });

  it("admits a member of the project who is not an admin", async () => {
    const proj = await insertProject({ key: "WR" });
    const member = await insertUser({ role: "member" });
    await addMember(proj.id, member.id);

    const details = await loadProjectDetails("WR", member);

    expect(details?.canEditRecord).toBe(true);
    expect(details?.canAdminister).toBe(false);
  });
});

describe("listProjectsForSidebar (FR-053, FR-054, OT-UX-020)", () => {
  it("orders active projects before archived ones, case-insensitively by name", async () => {
    await insertProject({ key: "Z1", name: "zephyr", status: "archived" });
    await insertProject({ key: "A1", name: "atlas" });
    await insertProject({ key: "B1", name: "Beacon" });

    const rows = await listProjectsForSidebar();

    expect(rows.map((row) => row.key)).toEqual(["A1", "B1", "Z1"]);
    expect(rows.map((row) => row.status)).toEqual(["active", "active", "archived"]);
  });

  it("breaks a tie between two projects sharing a name on the project's key", async () => {
    await insertProject({ key: "B1", name: "Same Name" });
    await insertProject({ key: "A1", name: "Same Name" });

    const rows = await listProjectsForSidebar();

    expect(rows.map((row) => row.key)).toEqual(["A1", "B1"]);
  });

  it("returns key, name and status for every project, with no actor argument to vary the result", async () => {
    await insertProject({ key: "WR", name: "Website Redesign" });

    const rows = await listProjectsForSidebar();

    expect(rows).toEqual([{ key: "WR", name: "Website Redesign", status: "active" }]);
  });
});