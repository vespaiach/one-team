import { beforeEach, describe, expect, it } from "vitest";
import { boardColumn, issue, project, user } from "@/db/schema";
import { testDb, testSql, truncateTestDatabase } from "@/db/test-database";
import { listAssignedIssues } from "./assigned-queries";

beforeEach(async () => {
  await truncateTestDatabase();
});

async function readServerWindowDates() {
  const [row] = await testSql<{ today: string; lastDay: string; dayAfter: string; yesterday: string }[]>`
    select to_char(current_date, 'YYYY-MM-DD') as today,
           to_char(current_date + 6, 'YYYY-MM-DD') as "lastDay",
           to_char(current_date + 7, 'YYYY-MM-DD') as "dayAfter",
           to_char(current_date - 1, 'YYYY-MM-DD') as yesterday
  `;
  if (!row) {
    throw new Error("current_date produced no row");
  }
  return row;
}

describe("listAssignedIssues computes dueThisWeek in PostgreSQL (FR-008, US1 s4, SC-013)", () => {
  it("marks today and day six, and marks neither day seven, yesterday nor a null due date", async () => {
    const window = await readServerWindowDates();
    const now = new Date();
    const [viewer] = await testDb
      .insert(user)
      .values({
        firstName: "Ada",
        lastName: "Lovelace",
        email: `ada-${crypto.randomUUID()}@example.com`,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    const [proj] = await testDb
      .insert(project)
      .values({ key: "WEB", name: "Website Redesign", createdAt: now, updatedAt: now })
      .returning();
    if (!viewer || !proj) {
      throw new Error("fixture produced no row");
    }
    const [column] = await testDb
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
    if (!column) {
      throw new Error("fixture produced no column");
    }

    const seeded: { number: number; dueDate: string | null }[] = [
      { number: 1, dueDate: window.today },
      { number: 2, dueDate: window.lastDay },
      { number: 3, dueDate: window.dayAfter },
      { number: 4, dueDate: window.yesterday },
      { number: 5, dueDate: null },
    ];
    await testDb.insert(issue).values(
      seeded.map(({ number, dueDate }) => ({
        projectId: proj.id,
        number,
        title: `Issue ${number}`,
        columnId: column.id,
        createdBy: viewer.id,
        assigneeId: viewer.id,
        dueDate,
        sortOrder: "a0",
        createdAt: now,
        updatedAt: now,
      })),
    );

    const rows = await listAssignedIssues(viewer.id);

    expect(
      rows
        .filter((row) => row.dueThisWeek)
        .map((row) => row.key)
        .sort(),
    ).toEqual(["WEB-1", "WEB-2"]);
    expect(
      rows
        .filter((row) => !row.dueThisWeek)
        .map((row) => row.key)
        .sort(),
    ).toEqual(["WEB-3", "WEB-4", "WEB-5"]);
  });
});