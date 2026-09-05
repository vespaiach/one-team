import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import {
  activity,
  boardColumn,
  comment,
  credential,
  issue,
  issueCounter,
  issueLabel,
  label,
  project,
  projectMember,
  user,
} from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { verifyPassword } from "@/features/auth/server/crypto";
import { SEED_COLUMNS } from "@/features/projects/seed-columns";
import { runSeed, SEED_PASSWORD } from "./seed";

const PROJECT_KEY_PATTERN = /^[A-Z][A-Z0-9]{0,7}$/;

beforeAll(async () => {
  await truncateTestDatabase();
  await testDb.insert(label).values({ name: "Stale Leftover", createdAt: new Date(), updatedAt: new Date() });
  await runSeed();
});

describe("runSeed users", () => {
  it("replaces whatever was there with ten users, one admin and nine members", async () => {
    const users = await testDb.select().from(user);

    expect(users).toHaveLength(10);
    expect(users.filter((row) => row.role === "admin")).toHaveLength(1);
    expect(users.filter((row) => row.role === "member")).toHaveLength(9);
  });

  it("gives every user a distinct email and a verifiable credential", async () => {
    const users = await testDb.select().from(user);
    const credentials = await testDb.select().from(credential);

    expect(new Set(users.map((row) => row.email.toLowerCase())).size).toBe(10);
    expect(credentials).toHaveLength(10);
    expect(new Set(credentials.map((row) => row.userId))).toEqual(new Set(users.map((row) => row.id)));

    const first = credentials[0];
    if (!first) throw new Error("expected a credential");
    expect(await verifyPassword(first.passwordHash, SEED_PASSWORD)).toBe(true);
  });

  it("gives every user profile details", async () => {
    const users = await testDb.select().from(user);

    for (const row of users) {
      expect(row.firstName).not.toBe("");
      expect(row.lastName).not.toBe("");
      expect(row.jobTitle).not.toBeNull();
      expect(row.bio).not.toBeNull();
    }
  });
});

describe("runSeed projects and membership", () => {
  it("creates ten projects with unique, well-formed keys and valid statuses", async () => {
    const projects = await testDb.select().from(project);

    expect(projects).toHaveLength(10);
    expect(new Set(projects.map((row) => row.key)).size).toBe(10);
    for (const row of projects) {
      expect(row.key).toMatch(PROJECT_KEY_PATTERN);
      expect(row.description).not.toBeNull();
      expect(["active", "archived"]).toContain(row.status);
    }
  });

  it("gives every project a membership drawn from the seeded users, varying between projects", async () => {
    const projects = await testDb.select().from(project);
    const users = await testDb.select().from(user);
    const memberships = await testDb.select().from(projectMember);
    const userIds = new Set(users.map((row) => row.id));

    for (const row of memberships) {
      expect(userIds.has(row.userId)).toBe(true);
    }

    const sizes = projects.map(
      (row) => memberships.filter((membership) => membership.projectId === row.id).length,
    );
    expect(sizes.every((size) => size > 0)).toBe(true);
    expect(new Set(sizes).size).toBeGreaterThan(1);
  });

  it("gives every project the default board columns and an issue counter", async () => {
    const projects = await testDb.select().from(project);

    for (const row of projects) {
      const columns = await testDb.select().from(boardColumn).where(eq(boardColumn.projectId, row.id));
      expect(columns.map((column) => column.name).sort()).toEqual(
        SEED_COLUMNS.map((column) => column.name).sort(),
      );

      const [counter] = await testDb.select().from(issueCounter).where(eq(issueCounter.projectId, row.id));
      const issues = await testDb.select().from(issue).where(eq(issue.projectId, row.id));
      expect(counter?.lastNumber).toBe(issues.length);
    }
  });
});

describe("runSeed cascading data", () => {
  it("numbers issues consecutively per project and keeps them inside their own project", async () => {
    const projects = await testDb.select().from(project);

    for (const row of projects) {
      const issues = await testDb.select().from(issue).where(eq(issue.projectId, row.id));
      expect(issues.length).toBeGreaterThan(0);
      expect(issues.map((item) => item.number).sort((a, b) => a - b)).toEqual(
        issues.map((_, index) => index + 1),
      );

      const columnIds = new Set(
        (await testDb.select().from(boardColumn).where(eq(boardColumn.projectId, row.id))).map(
          (column) => column.id,
        ),
      );
      const memberIds = new Set(
        (await testDb.select().from(projectMember).where(eq(projectMember.projectId, row.id))).map(
          (membership) => membership.userId,
        ),
      );

      for (const item of issues) {
        expect(columnIds.has(item.columnId)).toBe(true);
        expect(memberIds.has(item.createdBy)).toBe(true);
        expect(item.assigneeId === null || memberIds.has(item.assigneeId)).toBe(true);
        expect(new Set(item.sortOrder)).not.toEqual(new Set());
      }
    }
  });

  it("attaches labels to issues through the join table", async () => {
    const labels = await testDb.select().from(label);
    const links = await testDb.select().from(issueLabel);
    const issues = await testDb.select().from(issue);
    const labelIds = new Set(labels.map((row) => row.id));
    const issueIds = new Set(issues.map((row) => row.id));

    expect(labels.length).toBeGreaterThan(0);
    expect(labels.some((row) => row.name === "Stale Leftover")).toBe(false);
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(labelIds.has(link.labelId)).toBe(true);
      expect(issueIds.has(link.issueId)).toBe(true);
    }
  });

  it("writes comments on both issues and projects, each by a seeded author", async () => {
    const comments = await testDb.select().from(comment);
    const users = await testDb.select().from(user);
    const userIds = new Set(users.map((row) => row.id));

    expect(comments.filter((row) => row.issueId !== null).length).toBeGreaterThan(0);
    expect(comments.filter((row) => row.projectId !== null).length).toBeGreaterThan(0);
    for (const row of comments) {
      expect(userIds.has(row.authorId)).toBe(true);
      expect(row.body).not.toBe("");
    }
  });

  it("logs activity for project creation, membership, issue creation and comments", async () => {
    const activities = await testDb.select().from(activity);
    const projects = await testDb.select().from(project);
    const memberships = await testDb.select().from(projectMember);
    const issues = await testDb.select().from(issue);
    const comments = await testDb.select().from(comment);

    const projectCreated = activities.filter((row) => row.type === "created" && row.projectId !== null);
    const issueCreated = activities.filter((row) => row.type === "created" && row.issueId !== null);
    const memberAdded = activities.filter((row) => row.type === "member_added");
    const commentActivity = activities.filter((row) => row.type === "comment");

    expect(projectCreated).toHaveLength(projects.length);
    expect(issueCreated).toHaveLength(issues.length);
    expect(memberAdded).toHaveLength(memberships.length);
    expect(new Set(commentActivity.map((row) => row.commentId))).toEqual(
      new Set(comments.map((row) => row.id)),
    );
  });
});

describe("runSeed reset", () => {
  it("wipes the previous run instead of stacking a second one on top", async () => {
    await runSeed();

    expect(await testDb.select().from(user)).toHaveLength(10);
    expect(await testDb.select().from(project)).toHaveLength(10);
  });
});