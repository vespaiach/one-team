import { readFileSync } from "node:fs";
import { join } from "node:path";
import { and, asc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { activity, boardColumn, issue, issueCounter, project, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import type { Actor } from "@/features/auth/server/actor";
import { SEED_COLUMNS } from "../seed-columns";
import { createColumn, isColumnNameConflict } from "./create-column";

const { notFoundMock } = vi.hoisted(() => ({
  notFoundMock: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({ notFound: notFoundMock }));

beforeEach(async () => {
  await truncateTestDatabase();
  notFoundMock.mockClear();
});

async function insertUser(role: "admin" | "member") {
  const now = new Date();
  const [row] = await testDb
    .insert(user)
    .values({
      firstName: "Ada",
      lastName: "Lovelace",
      email: `ada-${crypto.randomUUID()}@example.com`,
      role,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!row) {
    throw new Error("insertUser produced no row");
  }
  return row;
}

function actorFor(row: { id: string; role: string }): Actor {
  return {
    id: row.id,
    role: row.role,
    firstName: "Ada",
    lastName: "Lovelace",
    avatarUrl: null,
    mustChangePassword: false,
  };
}

async function insertSeededProject(status: "active" | "archived" = "active") {
  const now = new Date();
  const [row] = await testDb
    .insert(project)
    .values({
      key: `P${crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      name: "Website Redesign",
      status,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!row) {
    throw new Error("insertSeededProject produced no row");
  }
  await testDb.insert(issueCounter).values({ projectId: row.id, lastNumber: 0 });
  await testDb
    .insert(boardColumn)
    .values(SEED_COLUMNS.map((column) => ({ ...column, projectId: row.id, createdAt: now, updatedAt: now })));
  return row;
}

async function columnsOf(projectId: string) {
  return testDb
    .select()
    .from(boardColumn)
    .where(eq(boardColumn.projectId, projectId))
    .orderBy(asc(boardColumn.sortOrder), asc(boardColumn.id));
}

async function insertIssue(projectId: string, columnId: string, createdBy: string) {
  const now = new Date();
  const [row] = await testDb
    .insert(issue)
    .values({
      projectId,
      number: 1,
      title: "An issue",
      columnId,
      createdBy,
      sortOrder: "a0",
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!row) {
    throw new Error("insertIssue produced no row");
  }
  return row;
}

describe("createColumn (FR-003, FR-006, FR-007, FR-010, FR-019, FR-022)", () => {
  it("appends one open column carrying the trimmed name, last in board order", async () => {
    const admin = await insertUser("admin");
    const proj = await insertSeededProject();
    const before = await columnsOf(proj.id);

    const result = await createColumn({ actor: actorFor(admin), projectKey: proj.key, name: "  Review  " });

    expect(result).toEqual({
      ok: true,
      column: {
        id: expect.any(String),
        name: "Review",
        kind: "open",
        position: 5,
        issueCount: 0,
        deleteRefusal: null,
      },
    });

    const after = await columnsOf(proj.id);
    expect(after).toHaveLength(6);
    const created = after[5];
    if (!created) {
      throw new Error("no created column");
    }
    expect(created.name).toBe("Review");
    expect(created.kind).toBe("open");
    expect(created.sortOrder > (before[4]?.sortOrder ?? "")).toBe(true);
    expect(created.createdAt).toBeInstanceOf(Date);
    expect(created.updatedAt).toBeInstanceOf(Date);
    expect(created.updatedAt.getTime()).toBeGreaterThanOrEqual(created.createdAt.getTime() - 1000);
    expect(after.slice(0, 5)).toEqual(before);
  });

  it("leaves every existing column and every issue untouched", async () => {
    const admin = await insertUser("admin");
    const proj = await insertSeededProject();
    const columns = await columnsOf(proj.id);
    const first = columns[0];
    if (!first) {
      throw new Error("no seeded column");
    }
    const existingIssue = await insertIssue(proj.id, first.id, admin.id);

    await createColumn({ actor: actorFor(admin), projectKey: proj.key, name: "Review" });

    const [issueAfter] = await testDb.select().from(issue).where(eq(issue.id, existingIssue.id));
    expect(issueAfter).toEqual(existingIssue);
    expect((await columnsOf(proj.id)).slice(0, 5)).toEqual(columns);
  });

  it("refuses a non-admin with forbidden and writes nothing", async () => {
    const member = await insertUser("member");
    const proj = await insertSeededProject();

    const result = await createColumn({ actor: actorFor(member), projectKey: proj.key, name: "Review" });

    expect(result).toEqual({ ok: false, error: "forbidden" });
    expect(await columnsOf(proj.id)).toHaveLength(5);
  });

  it("calls notFound() for an unknown project key and never forbidden", async () => {
    const member = await insertUser("member");

    await expect(
      createColumn({ actor: actorFor(member), projectKey: "NOPE", name: "Review" }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it("refuses an empty name and a 201-character name without truncating", async () => {
    const admin = await insertUser("admin");
    const proj = await insertSeededProject();

    expect(await createColumn({ actor: actorFor(admin), projectKey: proj.key, name: "   " })).toEqual({
      ok: false,
      error: "invalid_name",
      reason: "required",
    });
    expect(
      await createColumn({ actor: actorFor(admin), projectKey: proj.key, name: "x".repeat(201) }),
    ).toEqual({ ok: false, error: "invalid_name", reason: "too_long" });
    expect(await columnsOf(proj.id)).toHaveLength(5);
  });

  it("succeeds on an archived project, never consulting project.status", async () => {
    const admin = await insertUser("admin");
    const proj = await insertSeededProject("archived");

    const result = await createColumn({ actor: actorFor(admin), projectKey: proj.key, name: "Review" });

    expect(result.ok).toBe(true);
    expect(await columnsOf(proj.id)).toHaveLength(6);
  });
});

describe("createColumn uniqueness (FR-021, FR-051)", () => {
  it("refuses a name an existing column already holds, naming that column", async () => {
    const admin = await insertUser("admin");
    const proj = await insertSeededProject();
    const [backlog] = await testDb
      .select()
      .from(boardColumn)
      .where(and(eq(boardColumn.projectId, proj.id), eq(boardColumn.name, "Backlog")));
    if (!backlog) {
      throw new Error("no Backlog column");
    }

    const result = await createColumn({ actor: actorFor(admin), projectKey: proj.key, name: "Backlog" });

    expect(result).toEqual({
      ok: false,
      error: "duplicate_name",
      holder: { id: backlog.id, name: "Backlog" },
    });
    expect(await columnsOf(proj.id)).toHaveLength(5);
  });

  it("refuses a name differing only in case, carrying the stored casing", async () => {
    const admin = await insertUser("admin");
    const proj = await insertSeededProject();
    const [backlog] = await testDb
      .select()
      .from(boardColumn)
      .where(and(eq(boardColumn.projectId, proj.id), eq(boardColumn.name, "Backlog")));
    if (!backlog) {
      throw new Error("no Backlog column");
    }

    const result = await createColumn({ actor: actorFor(admin), projectKey: proj.key, name: " backlog " });

    expect(result).toEqual({
      ok: false,
      error: "duplicate_name",
      holder: { id: backlog.id, name: "Backlog" },
    });
  });

  it("allows the same name in another project", async () => {
    const admin = await insertUser("admin");
    const other = await insertSeededProject();
    const proj = await insertSeededProject();

    expect((await createColumn({ actor: actorFor(admin), projectKey: proj.key, name: "Review" })).ok).toBe(
      true,
    );
    expect((await createColumn({ actor: actorFor(admin), projectKey: other.key, name: "Review" })).ok).toBe(
      true,
    );
  });

  it("matches the 23505 by constraint name, re-throwing one that names another constraint", () => {
    const nameConflict = Object.assign(new Error("Failed query"), {
      cause: Object.assign(new Error("duplicate key"), {
        code: "23505",
        constraint_name: "board_column_project_id_name_lower_idx",
      }),
    });
    const otherConflict = Object.assign(new Error("Failed query"), {
      cause: Object.assign(new Error("duplicate key"), {
        code: "23505",
        constraint_name: "board_column_project_id_id_unique",
      }),
    });

    expect(isColumnNameConflict(nameConflict)).toBe(true);
    expect(isColumnNameConflict(otherConflict)).toBe(false);
  });

  it("runs no pre-flight uniqueness read — the holder is looked up only after the failed insert", () => {
    const source = readFileSync(
      join(process.cwd(), "src", "features", "projects", "server", "create-column.ts"),
      "utf8",
    );

    expect(source.indexOf("db.transaction")).toBeGreaterThan(-1);
    expect(source.indexOf("await findColumnNameHolder(")).toBeGreaterThan(source.indexOf("db.transaction"));
  });
});

describe("createColumn activity (FR-043…FR-046, FR-048)", () => {
  it("writes exactly one column_added row on the project's feed", async () => {
    const admin = await insertUser("admin");
    const proj = await insertSeededProject();

    await createColumn({ actor: actorFor(admin), projectKey: proj.key, name: "  Review  " });

    const rows = await testDb.select().from(activity).where(eq(activity.projectId, proj.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: "column_added",
      actorId: admin.id,
      projectId: proj.id,
      issueId: null,
      commentId: null,
      field: "Review",
      fromValue: null,
      toValue: null,
    });
  });

  it("leaves no activity row behind for a duplicate, an invalid name or a forbidden caller", async () => {
    const admin = await insertUser("admin");
    const member = await insertUser("member");
    const proj = await insertSeededProject();

    await createColumn({ actor: actorFor(admin), projectKey: proj.key, name: "Backlog" });
    await createColumn({ actor: actorFor(admin), projectKey: proj.key, name: "" });
    await createColumn({ actor: actorFor(member), projectKey: proj.key, name: "Review" });

    expect(await testDb.select().from(activity)).toHaveLength(0);
  });
});