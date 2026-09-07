import { createElement, Fragment, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
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
import { ALL_TABLES } from "@/db/tables";
import { testDb, testSql, truncateTestDatabase } from "@/db/test-database";
import { ActivitySection } from "@/features/home/components/activity-section";
import { AssignedSection } from "@/features/home/components/assigned-section";
import { MentionsSection } from "@/features/home/components/mentions-section";
import { ProjectsSection } from "@/features/home/components/projects-section";
import { StatCards } from "@/features/home/components/stat-cards";
import { countUnreadNotifications } from "@/features/notifications/server/notification-queries";
import { displayName } from "@/lib/display-name";

const DAY_MS = 24 * 60 * 60 * 1000;

type Census = Record<string, string[]>;

beforeEach(async () => {
  await truncateTestDatabase();
});

async function census(): Promise<Census> {
  const entries: [string, string[]][] = [];

  for (const table of ALL_TABLES) {
    const rows = await testSql.unsafe(`select to_jsonb(t) as row from "${table}" t`);
    entries.push([table, rows.map((row) => JSON.stringify(row.row)).sort()]);
  }

  return Object.fromEntries(entries);
}

async function seedEverySurface() {
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
  const [author] = await testDb
    .insert(user)
    .values({
      firstName: "Alan",
      lastName: "Turing",
      email: `alan-${crypto.randomUUID()}@example.com`,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!viewer || !author) {
    throw new Error("seeding produced no user");
  }

  const [projectRow] = await testDb
    .insert(project)
    .values({ key: "WEB", name: "Website Redesign", createdAt: now, updatedAt: now })
    .returning();
  if (!projectRow) {
    throw new Error("seeding produced no project");
  }

  await testDb
    .insert(projectMember)
    .values({ projectId: projectRow.id, userId: viewer.id, createdAt: now, updatedAt: now });

  const [column] = await testDb
    .insert(boardColumn)
    .values({
      projectId: projectRow.id,
      name: "Backlog",
      kind: "open",
      sortOrder: "a0",
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!column) {
    throw new Error("seeding produced no column");
  }

  const [issueRow] = await testDb
    .insert(issue)
    .values({
      projectId: projectRow.id,
      number: 142,
      title: "Fix the header",
      columnId: column.id,
      createdBy: author.id,
      assigneeId: viewer.id,
      dueDate: new Date(Date.now() + DAY_MS).toISOString().slice(0, 10),
      sortOrder: "a0",
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!issueRow) {
    throw new Error("seeding produced no issue");
  }

  const [commentRow] = await testDb
    .insert(comment)
    .values({
      authorId: author.id,
      body: "Ada, take a look.",
      issueId: issueRow.id,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!commentRow) {
    throw new Error("seeding produced no comment");
  }

  await testDb
    .insert(activity)
    .values({ actorId: author.id, type: "created", issueId: issueRow.id, createdAt: now });

  const [mention] = await testDb
    .insert(notification)
    .values({
      userId: viewer.id,
      actorId: author.id,
      type: "mention",
      issueId: issueRow.id,
      commentId: commentRow.id,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!mention) {
    throw new Error("seeding produced no notification");
  }

  return { viewer, mention };
}

async function renderEverySurface(userId: string, greeting: ReactNode): Promise<string> {
  return renderToStaticMarkup(
    createElement(
      Fragment,
      null,
      createElement("p", null, greeting),
      await StatCards({ userId }),
      await AssignedSection({ userId }),
      await ProjectsSection({ userId }),
      await MentionsSection({ userId }),
      await ActivitySection(),
    ),
  );
}

describe("Home writes nothing anywhere (FR-004, FR-043, SC-009, F-3)", () => {
  it("leaves every row of every table in ALL_TABLES identical across a full render", async () => {
    const { viewer } = await seedEverySurface();

    const before = await census();
    const markup = await renderEverySurface(viewer.id, displayName(viewer));
    const after = await census();

    expect(Object.keys(before)).toEqual([...ALL_TABLES]);
    expect(markup).toContain("Fix the header");
    expect(markup).toContain("Website Redesign");
    expect(after).toEqual(before);
  });
});

describe("an unread mention stays unread when its Home row is activated (FR-026, SC-006)", () => {
  it("keeps read_at null and the unread count unchanged, and offers no control that could change either", async () => {
    const { viewer, mention } = await seedEverySurface();

    const unreadBefore = await countUnreadNotifications(viewer.id);
    const before = await census();
    const markup = await renderEverySurface(viewer.id, displayName(viewer));

    expect(unreadBefore).toBe(1);
    expect(markup).toContain("Unread");
    expect(markup).toContain(`/projects/WEB/issues/142/details#comment-${mention.commentId}`);
    expect(markup).not.toContain("<form");
    expect(markup).not.toContain("<button");
    expect(markup).not.toContain("<input");

    const [row] = await testSql`select read_at from notification where id = ${mention.id}`;

    expect(row?.read_at).toBeNull();
    expect(await countUnreadNotifications(viewer.id)).toBe(unreadBefore);
    expect(await census()).toEqual(before);
  });
});