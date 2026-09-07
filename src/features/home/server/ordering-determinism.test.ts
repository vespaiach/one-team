import { beforeEach, describe, expect, it } from "vitest";
import {
  activity,
  boardColumn,
  comment,
  issue,
  notification,
  project,
  projectMember,
  user,
} from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { listRecentMentions } from "@/features/notifications/server/notification-queries";
import { listInstallationActivity } from "./activity-queries";
import { listAssignedIssues } from "./assigned-queries";
import { listMemberProjectsWithProgress } from "./project-queries";

const TIE_INSTANT = new Date("2026-03-01T12:00:00.000Z");
const MENTIONS_LIMIT = 5;
const INSERTION_ORDER = [2, 0, 3, 1];

function tiedId(table: number, position: number): string {
  return `${table}0000000-0000-7000-8000-00000000000${position}`;
}

beforeEach(async () => {
  await truncateTestDatabase();
});

async function insertUser(firstName: string) {
  const now = new Date();
  const [row] = await testDb
    .insert(user)
    .values({
      firstName,
      lastName: "Lovelace",
      email: `${firstName.toLowerCase()}-${crypto.randomUUID()}@example.com`,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!row) {
    throw new Error("insertUser produced no row");
  }
  return row;
}

async function insertProject(key: string, name: string) {
  const now = new Date();
  const [row] = await testDb
    .insert(project)
    .values({ key, name, createdAt: now, updatedAt: now })
    .returning();
  if (!row) {
    throw new Error("insertProject produced no row");
  }
  return row;
}

async function insertColumn(projectId: string) {
  const now = new Date();
  const [row] = await testDb
    .insert(boardColumn)
    .values({ projectId, name: "Backlog", kind: "open", sortOrder: "a0", createdAt: now, updatedAt: now })
    .returning();
  if (!row) {
    throw new Error("insertColumn produced no row");
  }
  return row;
}

async function seedTiesEverywhere() {
  const viewer = await insertUser("Ada");
  const author = await insertUser("Alan");
  const now = new Date();

  const second = await insertProject("BEE", "atlas");
  const first = await insertProject("AAA", "Atlas");

  for (const projectRow of [second, first]) {
    await testDb
      .insert(projectMember)
      .values({ projectId: projectRow.id, userId: viewer.id, createdAt: now, updatedAt: now });
  }

  const column = await insertColumn(second.id);
  const assignedIds: string[] = [];
  const mentionIds: string[] = [];
  const feedIds: string[] = [];

  for (const position of INSERTION_ORDER) {
    const [issueRow] = await testDb
      .insert(issue)
      .values({
        id: tiedId(1, position),
        projectId: second.id,
        number: position + 1,
        title: `Tied issue ${position}`,
        columnId: column.id,
        createdBy: author.id,
        assigneeId: viewer.id,
        sortOrder: `a${position}`,
        createdAt: TIE_INSTANT,
        updatedAt: TIE_INSTANT,
      })
      .returning();
    if (!issueRow) {
      throw new Error("seeding produced no issue");
    }
    assignedIds.push(issueRow.id);

    const [commentRow] = await testDb
      .insert(comment)
      .values({
        id: tiedId(2, position),
        authorId: author.id,
        body: `Tied comment ${position}`,
        issueId: issueRow.id,
        createdAt: TIE_INSTANT,
        updatedAt: TIE_INSTANT,
      })
      .returning();
    if (!commentRow) {
      throw new Error("seeding produced no comment");
    }
    feedIds.push(commentRow.id);

    const [activityRow] = await testDb
      .insert(activity)
      .values({
        id: tiedId(3, position),
        actorId: author.id,
        type: "created",
        issueId: issueRow.id,
        createdAt: TIE_INSTANT,
      })
      .returning();
    if (!activityRow) {
      throw new Error("seeding produced no activity");
    }
    feedIds.push(activityRow.id);

    const [mention] = await testDb
      .insert(notification)
      .values({
        id: tiedId(4, position),
        userId: viewer.id,
        actorId: author.id,
        type: "mention",
        issueId: issueRow.id,
        commentId: commentRow.id,
        createdAt: TIE_INSTANT,
        updatedAt: TIE_INSTANT,
      })
      .returning();
    if (!mention) {
      throw new Error("seeding produced no notification");
    }
    mentionIds.push(mention.id);
  }

  return {
    viewer,
    assignedNewestFirst: [...assignedIds].sort().reverse(),
    mentionsNewestFirst: [...mentionIds].sort().reverse().slice(0, MENTIONS_LIMIT),
    feedNewestFirst: [...feedIds].sort().reverse(),
  };
}

describe("every Home ordering is deterministic under a tie (FR-036, SC-012)", () => {
  it("returns Assigned to you in the same sequence twice, tied rows resolved on the instant tiebreak", async () => {
    const { viewer, assignedNewestFirst } = await seedTiesEverywhere();

    const first = await listAssignedIssues(viewer.id);
    const second = await listAssignedIssues(viewer.id);

    expect(first.map((row) => row.id)).toEqual(assignedNewestFirst);
    expect(second.map((row) => row.id)).toEqual(first.map((row) => row.id));
  });

  it("returns Your projects in the same sequence twice, ties resolved on lower(name) then key (conflict B)", async () => {
    const { viewer } = await seedTiesEverywhere();

    const first = await listMemberProjectsWithProgress(viewer.id);
    const second = await listMemberProjectsWithProgress(viewer.id);

    expect(first.map((row) => row.key)).toEqual(["AAA", "BEE"]);
    expect(second.map((row) => row.key)).toEqual(first.map((row) => row.key));
  });

  it("returns Mentions in the same sequence twice, tied rows resolved on the instant tiebreak", async () => {
    const { viewer, mentionsNewestFirst } = await seedTiesEverywhere();

    const first = await listRecentMentions(viewer.id, MENTIONS_LIMIT);
    const second = await listRecentMentions(viewer.id, MENTIONS_LIMIT);

    expect(first.map((row) => row.id)).toEqual(mentionsNewestFirst);
    expect(second.map((row) => row.id)).toEqual(first.map((row) => row.id));
  });

  it("returns Recent activity in the same sequence twice, ties across the union's two source tables included", async () => {
    const { feedNewestFirst } = await seedTiesEverywhere();

    const first = await listInstallationActivity();
    const second = await listInstallationActivity();

    expect(first.map((row) => row.id)).toEqual(feedNewestFirst.slice(0, first.length));
    expect(second.map((row) => row.id)).toEqual(first.map((row) => row.id));
  });
});