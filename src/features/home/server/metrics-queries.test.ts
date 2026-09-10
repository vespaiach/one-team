import { generateKeyBetween } from "fractional-indexing";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { boardColumn, issue, project, user } from "@/db/schema";
import { truncateTestDatabase } from "@/db/test-database";
import { countOpenIssuesForTeam } from "./metrics-queries";

const NOW = new Date("2026-01-01T00:00:00Z");

beforeEach(async () => {
  await truncateTestDatabase();
});

afterEach(async () => {
  await truncateTestDatabase();
});

describe("countOpenIssuesForTeam", () => {
  it("counts issues sitting in an open-kind column across every project", async () => {
    const [creator] = await db
      .insert(user)
      .values({
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@example.com",
        createdAt: NOW,
        updatedAt: NOW,
      })
      .returning();
    if (!creator) {
      throw new Error("failed to insert user");
    }
    const [proj] = await db
      .insert(project)
      .values({ key: "APOLLO", name: "Apollo Platform", createdAt: NOW, updatedAt: NOW })
      .returning();
    if (!proj) {
      throw new Error("failed to insert project");
    }
    const [todo] = await db
      .insert(boardColumn)
      .values({
        projectId: proj.id,
        name: "Todo",
        kind: "open",
        sortOrder: generateKeyBetween(null, null),
        createdAt: NOW,
        updatedAt: NOW,
      })
      .returning();
    const [done] = await db
      .insert(boardColumn)
      .values({
        projectId: proj.id,
        name: "Done",
        kind: "done",
        sortOrder: generateKeyBetween(null, null),
        createdAt: NOW,
        updatedAt: NOW,
      })
      .returning();
    if (!todo || !done) {
      throw new Error("failed to insert columns");
    }

    await db.insert(issue).values([
      {
        projectId: proj.id,
        number: 1,
        title: "Open one",
        columnId: todo.id,
        createdBy: creator.id,
        sortOrder: generateKeyBetween(null, null),
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        projectId: proj.id,
        number: 2,
        title: "Open two",
        columnId: todo.id,
        createdBy: creator.id,
        sortOrder: generateKeyBetween(null, null),
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        projectId: proj.id,
        number: 3,
        title: "Done one",
        columnId: done.id,
        createdBy: creator.id,
        sortOrder: generateKeyBetween(null, null),
        createdAt: NOW,
        updatedAt: NOW,
      },
    ]);

    expect(await countOpenIssuesForTeam()).toBe(2);
  });

  it("is zero when there are no issues", async () => {
    expect(await countOpenIssuesForTeam()).toBe(0);
  });
});