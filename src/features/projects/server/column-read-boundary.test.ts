import { asc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { boardColumn, issue, project, projectMember, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { SEED_COLUMNS } from "../seed-columns";
import { loadProjectDetails, type ProjectColumnRow } from "./queries";

beforeEach(async () => {
  await truncateTestDatabase();
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
  return { id: row.id, role: row.role };
}

async function insertSeededProject(key: string) {
  const now = new Date();
  const [row] = await testDb
    .insert(project)
    .values({ key, name: `Project ${key}`, createdAt: now, updatedAt: now })
    .returning();
  if (!row) {
    throw new Error("insertSeededProject produced no row");
  }
  await testDb
    .insert(boardColumn)
    .values(SEED_COLUMNS.map((column) => ({ ...column, projectId: row.id, createdAt: now, updatedAt: now })));
  return row;
}

async function addMember(projectId: string, userId: string) {
  const now = new Date();
  await testDb.insert(projectMember).values({ projectId, userId, createdAt: now, updatedAt: now });
}

async function columnNamed(projectId: string, name: string) {
  const rows = await testDb
    .select()
    .from(boardColumn)
    .where(eq(boardColumn.projectId, projectId))
    .orderBy(asc(boardColumn.sortOrder));
  const row = rows.find((column) => column.name === name);
  if (!row) {
    throw new Error(`no column named ${name}`);
  }
  return row;
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

async function columnsOf(key: string, actor: { id: string; role: string }) {
  const details = await loadProjectDetails(key, actor);
  if (!details) {
    throw new Error(`no project ${key}`);
  }
  return details.columns;
}

function withoutRefusal(columns: ProjectColumnRow[]) {
  return columns.map(({ deleteRefusal: _deleteRefusal, ...rest }) => rest);
}

async function setUpBoard() {
  const admin = await insertUser("admin");
  const member = await insertUser("member");
  const nonMember = await insertUser("member");

  const owned = await insertSeededProject("OWNED");
  const other = await insertSeededProject("OTHER");
  await addMember(owned.id, member.id);

  await insertIssue(owned.id, (await columnNamed(owned.id, "Backlog")).id, admin.id, 1);
  await insertIssue(owned.id, (await columnNamed(owned.id, "Backlog")).id, admin.id, 2);
  await insertIssue(owned.id, (await columnNamed(owned.id, "Todo")).id, admin.id, 3);
  await insertIssue(other.id, (await columnNamed(other.id, "Done")).id, admin.id, 1);

  return { admin, member, nonMember, owned, other };
}

describe("every signed-in user reads every project's columns (FR-009, FR-014, SC-009, US4-1, US4-5)", () => {
  it("gives the member, the non-member and the admin the same rows for the project the member belongs to", async () => {
    const { admin, member, nonMember } = await setUpBoard();

    const asMember = await columnsOf("OWNED", member);
    const asNonMember = await columnsOf("OWNED", nonMember);
    const asAdmin = await columnsOf("OWNED", admin);

    expect(asNonMember).toEqual(asMember);
    expect(withoutRefusal(asAdmin)).toEqual(withoutRefusal(asMember));
  });

  it("gives all three the same rows for a project none of them belongs to", async () => {
    const { admin, member, nonMember } = await setUpBoard();

    const asMember = await columnsOf("OTHER", member);
    const asNonMember = await columnsOf("OTHER", nonMember);
    const asAdmin = await columnsOf("OTHER", admin);

    expect(asNonMember).toEqual(asMember);
    expect(withoutRefusal(asAdmin)).toEqual(withoutRefusal(asMember));
  });

  it("carries every column in board order with its kind and its live issue count", async () => {
    const { nonMember } = await setUpBoard();

    expect(await columnsOf("OWNED", nonMember)).toEqual([
      {
        id: expect.any(String) as string,
        name: "Backlog",
        kind: "open",
        position: 0,
        issueCount: 2,
        deleteRefusal: null,
      },
      {
        id: expect.any(String) as string,
        name: "Todo",
        kind: "open",
        position: 1,
        issueCount: 1,
        deleteRefusal: null,
      },
      {
        id: expect.any(String) as string,
        name: "In Progress",
        kind: "open",
        position: 2,
        issueCount: 0,
        deleteRefusal: null,
      },
      {
        id: expect.any(String) as string,
        name: "Done",
        kind: "done",
        position: 3,
        issueCount: 0,
        deleteRefusal: null,
      },
      {
        id: expect.any(String) as string,
        name: "Canceled",
        kind: "canceled",
        position: 4,
        issueCount: 0,
        deleteRefusal: null,
      },
    ]);
  });

  it("moves an issue's count to the column that holds it, for every reader alike", async () => {
    const { admin, member, nonMember, owned } = await setUpBoard();
    const inProgress = await columnNamed(owned.id, "In Progress");
    await insertIssue(owned.id, inProgress.id, admin.id, 4);

    const counts = (columns: ProjectColumnRow[]) => columns.map((column) => column.issueCount);
    expect(counts(await columnsOf("OWNED", member))).toEqual([2, 1, 1, 0, 0]);
    expect(counts(await columnsOf("OWNED", nonMember))).toEqual([2, 1, 1, 0, 0]);
    expect(counts(await columnsOf("OWNED", admin))).toEqual([2, 1, 1, 0, 0]);
  });

  it("reads the same columns before and after the reader is made a member, membership never being consulted", async () => {
    const { nonMember, other } = await setUpBoard();

    const beforeJoining = await columnsOf("OTHER", nonMember);
    await addMember(other.id, nonMember.id);

    expect(await columnsOf("OTHER", nonMember)).toEqual(beforeJoining);
  });
});

describe("deleteRefusal is an admin's affordance only (FR-016, US4-1)", () => {
  it("is null on every column for both non-admins, including the ones an admin sees refused", async () => {
    const { admin, member, nonMember } = await setUpBoard();

    const asAdmin = await columnsOf("OWNED", admin);
    expect(asAdmin.map((column) => column.deleteRefusal)).toEqual([
      "holds_issues",
      "holds_issues",
      null,
      "last_done_kind",
      "last_canceled_kind",
    ]);

    for (const columns of [await columnsOf("OWNED", member), await columnsOf("OWNED", nonMember)]) {
      expect(columns.map((column) => column.deleteRefusal)).toEqual([null, null, null, null, null]);
    }
  });

  it("is null for a non-admin on a project whose only column an admin sees as last_column", async () => {
    const { admin, nonMember } = await setUpBoard();
    const single = await insertSeededProject("SOLO");
    await testDb.delete(boardColumn).where(eq(boardColumn.projectId, single.id));
    const now = new Date();
    await testDb.insert(boardColumn).values({
      projectId: single.id,
      name: "Backlog",
      kind: "open",
      sortOrder: "a0",
      createdAt: now,
      updatedAt: now,
    });

    expect((await columnsOf("SOLO", admin)).map((column) => column.deleteRefusal)).toEqual(["last_column"]);
    expect((await columnsOf("SOLO", nonMember)).map((column) => column.deleteRefusal)).toEqual([null]);
  });
});