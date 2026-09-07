import { eq } from "drizzle-orm";
import { createElement, Fragment, isValidElement, type ReactElement, type ReactNode, Suspense } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

const { requireActorMock } = vi.hoisted(() => ({ requireActorMock: vi.fn() }));
vi.mock("@/features/auth/server/actor", () => ({ requireActor: requireActorMock }));

type SurfaceProps = { children?: ReactNode; fallback?: ReactNode };

beforeEach(async () => {
  await truncateTestDatabase();
  vi.clearAllMocks();
});

function elements(node: ReactNode): ReactElement<SurfaceProps>[] {
  if (Array.isArray(node)) {
    return node.flatMap(elements);
  }
  if (!isValidElement(node)) {
    return [];
  }
  const element = node as ReactElement<SurfaceProps>;
  return [element, ...elements(element.props.children)];
}

async function renderHome(): Promise<string> {
  const { default: HomePage } = await import("./page");
  const tree = await HomePage();
  const resolved: ReactNode[] = [];

  for (const boundary of elements(tree).filter((element) => element.type === Suspense)) {
    const [surface] = elements(boundary.props.children);
    const component = surface.type as (props: unknown) => Promise<ReactNode>;
    resolved.push(await component(surface.props));
  }

  return renderToStaticMarkup(
    createElement(
      Fragment,
      null,
      ...resolved.map((node, index) => createElement(Fragment, { key: index }, node)),
    ),
  );
}

async function seedFirstVisit() {
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
      number: 1,
      title: "Header is misaligned",
      columnId: column.id,
      createdBy: author.id,
      assigneeId: viewer.id,
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

  await testDb.insert(notification).values({
    userId: viewer.id,
    actorId: author.id,
    type: "mention",
    issueId: issueRow.id,
    commentId: commentRow.id,
    createdAt: now,
    updatedAt: now,
  });

  await testDb
    .insert(activity)
    .values({ actorId: author.id, type: "created", issueId: issueRow.id, createdAt: now });

  return { viewer, author, projectRow, column, issueRow };
}

describe("Home re-queries on revisit rather than serving what the first visit read (FR-039, US5 s2, D-3)", () => {
  it("reports the changed rows behind all six surfaces on the second render", async () => {
    const { viewer, author, projectRow, column, issueRow } = await seedFirstVisit();
    requireActorMock.mockResolvedValue({
      id: viewer.id,
      role: "member",
      firstName: viewer.firstName,
      lastName: viewer.lastName,
      avatarUrl: null,
      mustChangePassword: false,
    });

    const firstVisit = await renderHome();

    expect(firstVisit).toContain("Header is misaligned");
    expect(firstVisit).toContain("Website Redesign");
    expect(firstVisit).not.toContain("Footer overlaps the fold");

    const later = new Date();

    await testDb.update(issue).set({ title: "Footer overlaps the fold" }).where(eq(issue.id, issueRow.id));
    await testDb.update(project).set({ name: "Marketing Site" }).where(eq(project.id, projectRow.id));

    const [secondIssue] = await testDb
      .insert(issue)
      .values({
        projectId: projectRow.id,
        number: 2,
        title: "Nav collapses too early",
        columnId: column.id,
        createdBy: author.id,
        assigneeId: viewer.id,
        sortOrder: "a1",
        createdAt: later,
        updatedAt: later,
      })
      .returning();
    if (!secondIssue) {
      throw new Error("the change produced no issue");
    }

    const [secondComment] = await testDb
      .insert(comment)
      .values({
        authorId: author.id,
        body: "Ada, one more thing.",
        issueId: secondIssue.id,
        createdAt: later,
        updatedAt: later,
      })
      .returning();
    if (!secondComment) {
      throw new Error("the change produced no comment");
    }

    await testDb.insert(notification).values({
      userId: viewer.id,
      actorId: author.id,
      type: "mention",
      issueId: secondIssue.id,
      commentId: secondComment.id,
      createdAt: later,
      updatedAt: later,
    });

    await testDb
      .insert(activity)
      .values({ actorId: author.id, type: "created", issueId: secondIssue.id, createdAt: later });

    const secondVisit = await renderHome();

    expect(secondVisit).toContain("Footer overlaps the fold");
    expect(secondVisit).toContain("Nav collapses too early");
    expect(secondVisit).toContain("Marketing Site");
    expect(secondVisit).toContain("WEB-2");
    expect(secondVisit).not.toContain("Header is misaligned");
    expect(secondVisit).not.toContain("Website Redesign");
  });

  it("counts the cards from the second visit's own rows, so nothing a revisit shows spans requests", async () => {
    const { viewer, author, projectRow, column } = await seedFirstVisit();
    requireActorMock.mockResolvedValue({
      id: viewer.id,
      role: "member",
      firstName: viewer.firstName,
      lastName: viewer.lastName,
      avatarUrl: null,
      mustChangePassword: false,
    });

    const firstVisit = await renderHome();

    expect(firstVisit).toContain(
      '>1</span><span class="text-label text-(--color-text-muted)">Assigned to you',
    );
    expect(firstVisit).toContain('>1</span><span class="text-label text-(--color-text-muted)">Unread');

    const later = new Date();

    const [thirdIssue] = await testDb
      .insert(issue)
      .values({
        projectId: projectRow.id,
        number: 3,
        title: "Search returns nothing",
        columnId: column.id,
        createdBy: author.id,
        assigneeId: viewer.id,
        sortOrder: "a2",
        createdAt: later,
        updatedAt: later,
      })
      .returning();
    if (!thirdIssue) {
      throw new Error("the change produced no issue");
    }

    const [thirdComment] = await testDb
      .insert(comment)
      .values({
        authorId: author.id,
        body: "Ada, and this one.",
        issueId: thirdIssue.id,
        createdAt: later,
        updatedAt: later,
      })
      .returning();
    if (!thirdComment) {
      throw new Error("the change produced no comment");
    }

    await testDb.insert(notification).values({
      userId: viewer.id,
      actorId: author.id,
      type: "mention",
      issueId: thirdIssue.id,
      commentId: thirdComment.id,
      createdAt: later,
      updatedAt: later,
    });

    const secondVisit = await renderHome();

    expect(secondVisit).toContain(
      '>2</span><span class="text-label text-(--color-text-muted)">Assigned to you',
    );
    expect(secondVisit).toContain('>2</span><span class="text-label text-(--color-text-muted)">Unread');
  });
});