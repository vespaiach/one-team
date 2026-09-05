import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { boardColumn, issue, project, projectMember, user } from "@/db/schema";
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

async function insertIssue(projectId: string, columnId: string, createdBy: string, number: number) {
  const now = new Date();
  await testDb.insert(issue).values({
    projectId,
    number,
    title: `Issue ${number}`,
    columnId,
    createdBy,
    sortOrder: `a${number}`,
    createdAt: now,
    updatedAt: now,
  });
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

  it("returns a live issueCount per column, counting only that column's issues", async () => {
    const admin = await insertUser({ role: "admin" });
    const proj = await insertProject({ key: "WR" });
    await insertSeedColumns(proj.id);
    const columns = await testDb.select().from(boardColumn).where(eq(boardColumn.projectId, proj.id));
    const backlog = columns.find((column) => column.name === "Backlog");
    const todo = columns.find((column) => column.name === "Todo");
    if (!backlog || !todo) {
      throw new Error("seed columns are missing");
    }
    await insertIssue(proj.id, backlog.id, admin.id, 1);
    await insertIssue(proj.id, backlog.id, admin.id, 2);
    await insertIssue(proj.id, todo.id, admin.id, 3);

    const details = await loadProjectDetails("WR", admin);

    expect(details?.columns.find((column) => column.name === "Backlog")?.issueCount).toBe(2);
    expect(details?.columns.find((column) => column.name === "Todo")?.issueCount).toBe(1);
    expect(details?.columns.find((column) => column.name === "Done")?.issueCount).toBe(0);
  });

  it("reads the columns ordered by sort_order then id, so a tie is never rendered two ways", () => {
    const source = readFileSync(join(__dirname, "queries.ts"), "utf8");
    const ordering = source.match(/from\(boardColumn\)[\s\S]*?\.orderBy\(([^)]*\)[^;]*?)\);/);

    expect(ordering?.[1]).toContain("asc(boardColumn.sortOrder)");
    expect(ordering?.[1]).toContain("asc(boardColumn.id)");
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

  it("carries deleteRefusal null for a column an admin can delete", async () => {
    const admin = await insertUser({ role: "admin" });
    const proj = await insertProject({ key: "WR" });
    await insertSeedColumns(proj.id);

    const details = await loadProjectDetails("WR", admin);

    expect(details?.columns.find((column) => column.name === "Backlog")?.deleteRefusal).toBeNull();
    expect(details?.columns.find((column) => column.name === "Todo")?.deleteRefusal).toBeNull();
    expect(details?.columns.find((column) => column.name === "In Progress")?.deleteRefusal).toBeNull();
  });

  it("carries the refusal each column would meet, in the mutator's precedence", async () => {
    const admin = await insertUser({ role: "admin" });
    const proj = await insertProject({ key: "WR" });
    await insertSeedColumns(proj.id);
    const columns = await testDb.select().from(boardColumn).where(eq(boardColumn.projectId, proj.id));
    const todo = columns.find((column) => column.name === "Todo");
    if (!todo) {
      throw new Error("seed columns are missing");
    }
    await insertIssue(proj.id, todo.id, admin.id, 1);

    const details = await loadProjectDetails("WR", admin);

    expect(details?.columns.find((column) => column.name === "Todo")?.deleteRefusal).toBe("holds_issues");
    expect(details?.columns.find((column) => column.name === "Done")?.deleteRefusal).toBe("last_done_kind");
    expect(details?.columns.find((column) => column.name === "Canceled")?.deleteRefusal).toBe(
      "last_canceled_kind",
    );
    expect(details?.columns.find((column) => column.name === "Backlog")?.deleteRefusal).toBeNull();
  });

  it("reports last_column for a project's only column, ahead of the kind refusals it also meets", async () => {
    const admin = await insertUser({ role: "admin" });
    const proj = await insertProject({ key: "WR" });
    const now = new Date();
    await testDb.insert(boardColumn).values({
      projectId: proj.id,
      name: "Done",
      kind: "done",
      sortOrder: "a0",
      createdAt: now,
      updatedAt: now,
    });

    const details = await loadProjectDetails("WR", admin);

    expect(details?.columns).toHaveLength(1);
    expect(details?.columns[0]?.deleteRefusal).toBe("last_column");
  });

  it("reports holds_issues for a non-empty column that is also the project's last", async () => {
    const admin = await insertUser({ role: "admin" });
    const proj = await insertProject({ key: "WR" });
    const now = new Date();
    const [only] = await testDb
      .insert(boardColumn)
      .values({
        projectId: proj.id,
        name: "Backlog",
        kind: "open",
        sortOrder: "a0",
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    if (!only) {
      throw new Error("column insert produced no row");
    }
    await insertIssue(proj.id, only.id, admin.id, 1);

    const details = await loadProjectDetails("WR", admin);

    expect(details?.columns[0]?.deleteRefusal).toBe("holds_issues");
  });

  it("refuses neither of two done-kind columns, the restriction being on the last of a kind", async () => {
    const admin = await insertUser({ role: "admin" });
    const proj = await insertProject({ key: "WR" });
    await insertSeedColumns(proj.id);
    const now = new Date();
    await testDb.insert(boardColumn).values({
      projectId: proj.id,
      name: "Shipped",
      kind: "done",
      sortOrder: "a5",
      createdAt: now,
      updatedAt: now,
    });

    const details = await loadProjectDetails("WR", admin);

    expect(details?.columns.find((column) => column.name === "Done")?.deleteRefusal).toBeNull();
    expect(details?.columns.find((column) => column.name === "Shipped")?.deleteRefusal).toBeNull();
  });

  it("leaves deleteRefusal null for every column a non-admin reads, who is offered no Delete control", async () => {
    const proj = await insertProject({ key: "WR" });
    await insertSeedColumns(proj.id);
    const member = await insertUser({ role: "member" });
    await addMember(proj.id, member.id);
    const columns = await testDb.select().from(boardColumn).where(eq(boardColumn.projectId, proj.id));
    const todo = columns.find((column) => column.name === "Todo");
    if (!todo) {
      throw new Error("seed columns are missing");
    }
    await insertIssue(proj.id, todo.id, member.id, 1);

    const details = await loadProjectDetails("WR", member);

    expect(details?.canAdminister).toBe(false);
    expect(details?.columns.every((column) => column.deleteRefusal === null)).toBe(true);
  });

  it("exposes no sort_order on a column row", async () => {
    const admin = await insertUser({ role: "admin" });
    const proj = await insertProject({ key: "WR" });
    await insertSeedColumns(proj.id);

    const details = await loadProjectDetails("WR", admin);

    expect(Object.keys(details?.columns[0] ?? {}).sort()).toEqual([
      "deleteRefusal",
      "id",
      "issueCount",
      "kind",
      "name",
      "position",
    ]);
  });

  it("chooses deleteRefusal through the same selector deleteColumn uses", () => {
    const source = readFileSync(join(__dirname, "queries.ts"), "utf8");

    expect(source).toContain('from "./column-delete-refusal"');
    expect(source).toContain("selectColumnDeleteRefusal");
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