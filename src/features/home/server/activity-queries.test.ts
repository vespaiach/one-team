import { generateKeyBetween } from "fractional-indexing";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { activity, boardColumn, comment, issue, project, user } from "@/db/schema";
import { truncateTestDatabase } from "@/db/test-database";
import { listInstallationActivity } from "./activity-queries";

const NOW = new Date("2026-01-01T00:00:00Z");

beforeEach(async () => {
  await truncateTestDatabase();
});

afterEach(async () => {
  await truncateTestDatabase();
});

async function seedProjectWithIssue() {
  const [actor] = await db
    .insert(user)
    .values({
      firstName: "Grace",
      lastName: "Hopper",
      email: "grace@example.com",
      createdAt: NOW,
      updatedAt: NOW,
    })
    .returning();
  if (!actor) {
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
  if (!todo) {
    throw new Error("failed to insert column");
  }
  const [issueRow] = await db
    .insert(issue)
    .values({
      projectId: proj.id,
      number: 1,
      title: "Fix the flux capacitor",
      columnId: todo.id,
      createdBy: actor.id,
      sortOrder: generateKeyBetween(null, null),
      createdAt: NOW,
      updatedAt: NOW,
    })
    .returning();
  if (!issueRow) {
    throw new Error("failed to insert issue");
  }
  return { actor, proj, issueRow };
}

describe("listInstallationActivity", () => {
  it("carries the comment body for a comment row, and null for other kinds", async () => {
    const { actor, issueRow } = await seedProjectWithIssue();
    await db.insert(comment).values({
      authorId: actor.id,
      body: "This one needs a design review before we commit.",
      issueId: issueRow.id,
      createdAt: NOW,
      updatedAt: NOW,
    });
    await db.insert(activity).values({
      actorId: actor.id,
      type: "created",
      issueId: issueRow.id,
      createdAt: new Date(NOW.getTime() - 1000),
    });

    const rows = await listInstallationActivity();

    const commentRow = rows.find((row) => row.kind === "comment");
    const createdRow = rows.find((row) => row.kind === "created");
    expect(commentRow?.body).toBe("This one needs a design review before we commit.");
    expect(createdRow?.body).toBeNull();
  });
});