import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { boardColumn, issue, label, notification, project, projectMember, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { createComment } from "@/features/activity/server/create-comment";
import type { Actor } from "@/features/auth/server/actor";
import { issueSession, SESSION_COOKIE_NAME } from "@/features/auth/server/sessions";
import { addIssueLabel, removeIssueLabel } from "@/features/labels/server/issue-labels";
import { updateOwnProfile } from "@/features/profile/actions";
import { createColumn } from "@/features/projects/server/create-column";
import { deleteColumn } from "@/features/projects/server/delete-column";
import { addProjectMember, removeProjectMember } from "@/features/projects/server/membership";
import { moveColumn } from "@/features/projects/server/move-column";
import { setProjectStatus } from "@/features/projects/server/project-status";
import { updateColumn } from "@/features/projects/server/update-column";

const ORIGINAL_APP_URL = process.env.APP_URL;
const cookieJar = new Map<string, string>();

vi.mock("next/cache", () => ({
  refresh: () => undefined,
  revalidatePath: () => undefined,
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ origin: "https://app.example.com" }),
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { value: cookieJar.get(name) } : undefined),
    set: (name: string, value: string) => {
      cookieJar.set(name, value);
    },
    delete: (name: string) => {
      cookieJar.delete(name);
    },
  }),
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

beforeEach(async () => {
  await truncateTestDatabase();
  process.env.APP_URL = "https://app.example.com";
  cookieJar.clear();
});

afterEach(() => {
  process.env.APP_URL = ORIGINAL_APP_URL;
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

async function insertProjectWithColumns() {
  const now = new Date();
  const [proj] = await testDb
    .insert(project)
    .values({
      key: `P${crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      name: "Website Redesign",
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!proj) {
    throw new Error("insertProject produced no row");
  }
  const columns = await testDb
    .insert(boardColumn)
    .values([
      { projectId: proj.id, name: "Backlog", kind: "open", sortOrder: "a0", createdAt: now, updatedAt: now },
      { projectId: proj.id, name: "Doing", kind: "open", sortOrder: "a1", createdAt: now, updatedAt: now },
    ])
    .returning();
  const [backlog, doing] = columns;
  if (!backlog || !doing) {
    throw new Error("insertColumns produced no rows");
  }
  return { proj, backlog, doing };
}

async function insertIssueRow(projectId: string, columnId: string, createdBy: string) {
  const now = new Date();
  const [row] = await testDb
    .insert(issue)
    .values({
      projectId,
      number: 1,
      title: "Fix the header",
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

async function insertLabel() {
  const now = new Date();
  const [row] = await testDb
    .insert(label)
    .values({ name: `Bug ${crypto.randomUUID()}`, createdAt: now, updatedAt: now })
    .returning();
  if (!row) {
    throw new Error("insertLabel produced no row");
  }
  return row;
}

async function addMember(projectId: string, userId: string) {
  const now = new Date();
  await testDb.insert(projectMember).values({ projectId, userId, createdAt: now, updatedAt: now });
}

function actorFor(userRow: typeof user.$inferSelect): Actor {
  return {
    id: userRow.id,
    role: userRow.role,
    firstName: userRow.firstName,
    lastName: userRow.lastName,
    avatarUrl: null,
    mustChangePassword: false,
  };
}

async function census() {
  return testDb.select().from(notification);
}

describe("the census sees a write when one happens (research F-2)", () => {
  it("counts the rows a comment on the same seed produces", async () => {
    const { proj, backlog } = await insertProjectWithColumns();
    const author = await insertUser();
    const creator = await insertUser();
    await addMember(proj.id, author.id);
    await addMember(proj.id, creator.id);
    const issueRow = await insertIssueRow(proj.id, backlog.id, creator.id);
    const before = await census();

    const result = await createComment({
      target: { issueId: issueRow.id },
      actor: actorFor(author),
      body: "Looks good.",
    });

    expect(result.status).toBe("ok");
    expect(await census()).toHaveLength(before.length + 1);
  });
});

describe("the events that notify nobody (FR-042, SC-003)", () => {
  it("writes nothing for a project status change", async () => {
    const { proj } = await insertProjectWithColumns();
    const admin = await insertUser({ role: "admin" });
    const before = await census();

    await setProjectStatus(proj.id, "archived", admin.id);
    await setProjectStatus(proj.id, "active", admin.id);

    expect(await census()).toEqual(before);
  });

  it("writes nothing for a label applied or removed", async () => {
    const { proj, backlog } = await insertProjectWithColumns();
    const member = await insertUser();
    await addMember(proj.id, member.id);
    const issueRow = await insertIssueRow(proj.id, backlog.id, member.id);
    const labelRow = await insertLabel();
    const before = await census();

    expect(
      await addIssueLabel({ actor: actorFor(member), issueId: issueRow.id, labelId: labelRow.id }),
    ).toEqual({
      ok: true,
      applied: true,
    });
    expect(
      await removeIssueLabel({ actor: actorFor(member), issueId: issueRow.id, labelId: labelRow.id }),
    ).toEqual({ ok: true, applied: false });

    expect(await census()).toEqual(before);
  });

  it("writes nothing for a column created, renamed, moved or deleted", async () => {
    const { proj, backlog, doing } = await insertProjectWithColumns();
    const admin = await insertUser({ role: "admin" });
    const before = await census();

    const created = await createColumn({ actor: actorFor(admin), projectKey: proj.key, name: "Review" });
    expect(created.ok).toBe(true);
    expect(await updateColumn({ actor: actorFor(admin), columnId: doing.id, name: "In progress" })).toEqual({
      ok: true,
    });
    expect(
      await moveColumn({
        actor: actorFor(admin),
        columnId: doing.id,
        targetColumnId: backlog.id,
        placement: "before",
      }),
    ).toEqual({ ok: true });
    expect(await deleteColumn({ actor: actorFor(admin), projectId: proj.id, columnId: doing.id })).toEqual({
      ok: true,
    });

    expect(await census()).toEqual(before);
  });

  it("writes nothing for a membership added or removed", async () => {
    const { proj } = await insertProjectWithColumns();
    const admin = await insertUser({ role: "admin" });
    const joiner = await insertUser();
    const before = await census();

    await addProjectMember(proj.id, joiner.id, admin.id);
    await removeProjectMember(proj.id, joiner.id, admin.id);

    expect(await census()).toEqual(before);
  });

  it("writes nothing for a profile edit", async () => {
    const owner = await insertUser();
    const { token } = await issueSession({ userId: owner.id, ipAddress: "203.0.113.4", userAgent: null });
    cookieJar.set(SESSION_COOKIE_NAME, token);
    const before = await census();

    expect(await updateOwnProfile("jobTitle", "Engineer")).toEqual({ status: "accepted" });

    expect(await census()).toEqual(before);
  });
});