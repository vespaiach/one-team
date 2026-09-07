import { readFileSync } from "node:fs";
import { isValidElement, type ReactElement, type ReactNode, Suspense } from "react";
import { describe, expect, it, vi } from "vitest";
import { displayName } from "@/lib/display-name";

const { requireActorMock } = vi.hoisted(() => ({ requireActorMock: vi.fn() }));
vi.mock("@/features/auth/server/actor", () => ({ requireActor: requireActorMock }));

const { listAssignedIssuesMock, countUnreadNotificationsMock, listRecentMentionsMock } = vi.hoisted(() => ({
  listAssignedIssuesMock: vi.fn(),
  countUnreadNotificationsMock: vi.fn(),
  listRecentMentionsMock: vi.fn(),
}));
vi.mock("@/features/home/server/assigned-queries", () => ({
  listAssignedIssues: listAssignedIssuesMock,
}));
vi.mock("@/features/notifications/server/notification-queries", () => ({
  countUnreadNotifications: countUnreadNotificationsMock,
  listRecentMentions: listRecentMentionsMock,
}));

const actor = {
  id: "u1",
  role: "member",
  firstName: "Ada",
  lastName: "Lovelace",
  avatarUrl: null,
  mustChangePassword: false,
};

const otherActor = { ...actor, id: "u2", firstName: "Grace", lastName: "Hopper" };

type SurfaceProps = { children?: ReactNode; fallback?: ReactNode };

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

function typeNames(node: ReactNode): string[] {
  return elements(node).map(({ type }) => {
    if (typeof type === "string") {
      return type;
    }
    if (typeof type === "function") {
      return type.name;
    }
    return String(type);
  });
}

function text(node: ReactNode): string {
  if (Array.isArray(node)) {
    return node.map(text).join("");
  }
  if (typeof node === "string") {
    return node;
  }
  if (typeof node === "number") {
    return String(node);
  }
  if (isValidElement(node)) {
    const element = node as ReactElement<{ children?: ReactNode }>;
    return text(element.props.children);
  }
  return "";
}

function suspenseBoundaries(node: ReactNode): ReactElement<SurfaceProps>[] {
  return elements(node).filter((element) => element.type === Suspense);
}

function mountedName(node: ReactNode): string {
  return typeNames(node)[0];
}

async function renderSurface(node: ReactNode): Promise<ReactNode> {
  const [surface] = elements(node);
  const component = surface.type as (props: unknown) => Promise<ReactNode>;

  return await component(surface.props);
}

function statCardCount(node: ReactNode, label: string): string {
  const card = elements(node).find((element) => element.type === "li" && text(element).includes(label));

  return text(card).replace(label, "");
}

function redirectToSignin(): never {
  throw Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/signin;307;" });
}

describe("/home (FR-003, s3)", () => {
  it("calls requireActor before rendering anything", async () => {
    requireActorMock.mockResolvedValue(actor);
    const { default: HomePage } = await import("./page");

    await HomePage();

    expect(requireActorMock).toHaveBeenCalledTimes(1);
  });

  it("renders no header — no title block, no per-screen control, no New issue control", async () => {
    requireActorMock.mockResolvedValue(actor);
    const { default: HomePage } = await import("./page");

    const result = await HomePage();

    expect(typeNames(result)).not.toContain("header");
    expect(typeNames(result)).not.toContain("h1");
    expect(typeNames(result)).not.toContain("ScreenHeader");
    expect(text(result)).not.toContain("New issue");
  });

  it("redirects to /signin rather than rendering, when there is no actor", async () => {
    requireActorMock.mockImplementation(() => {
      throw Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/signin;307;" });
    });
    const { default: HomePage } = await import("./page");

    await expect(HomePage()).rejects.toMatchObject({
      digest: expect.stringContaining(";/signin;") as string,
    });
  });
});

describe("/home frame (FR-001, FR-003, FR-005, US1 s7, US5 s4)", () => {
  it("greets the viewer by the application's display-name rule — first name, one space, last name", async () => {
    const { default: HomePage } = await import("./page");

    requireActorMock.mockResolvedValue(actor);
    const mine = text(await HomePage());

    expect(mine).toContain(displayName(actor));
    expect(mine).toContain("Ada Lovelace");
    expect(mine).not.toContain("AdaLovelace");

    requireActorMock.mockResolvedValue(otherActor);
    const theirs = text(await HomePage());

    expect(theirs).toContain(displayName(otherActor));
    expect(theirs).not.toContain(displayName(actor));
  });

  it("renders the greeting first, inside the one ordered container the six surfaces mount into", async () => {
    requireActorMock.mockResolvedValue(actor);
    const { default: HomePage } = await import("./page");

    const [container, greeting] = elements(await HomePage());

    expect(container).toBeDefined();
    expect(greeting).toBeDefined();
    expect(text(greeting)).toBe(displayName(actor));
  });

  it("renders no fragment of the frame when there is no actor — the /signin redirect propagates", async () => {
    const { default: HomePage } = await import("./page");

    requireActorMock.mockResolvedValue(actor);

    expect(text(await HomePage())).toContain(displayName(actor));

    requireActorMock.mockImplementation(redirectToSignin);

    await expect(HomePage()).rejects.toMatchObject({
      digest: expect.stringContaining(";/signin;") as string,
    });
  });

  it("takes the greeting from the session alone: a userId in the request changes nothing, and no validator is written", async () => {
    requireActorMock.mockResolvedValue(actor);
    const { default: HomePage } = await import("./page");
    const page = HomePage as (props?: unknown) => Promise<ReactNode>;

    const rendered = text(
      await page({
        params: Promise.resolve({}),
        searchParams: Promise.resolve({ userId: otherActor.id }),
      }),
    );

    expect(rendered).toContain(displayName(actor));
    expect(rendered).not.toContain(otherActor.id);
    expect(rendered).not.toContain(displayName(otherActor));

    const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

    expect(source).toContain("export default async function HomePage()");
    expect(source).not.toMatch(/\bparams\b/);
    expect(source).not.toMatch(/\bsearchParams\b/);
    expect(source).not.toMatch(/\bparse\b|\bsafeParse\b|\bvalidate\b|\bschema\b/i);
  });
});
describe("/home US1 wiring (FR-001, FR-007, FR-038, SC-002)", () => {
  const assigned = [
    {
      id: "i1",
      key: "WEB-1",
      title: "First",
      projectName: "Web",
      href: "/projects/WEB/issues/1/details",
      dueThisWeek: true,
    },
    {
      id: "i2",
      key: "WEB-2",
      title: "Second",
      projectName: "Web",
      href: "/projects/WEB/issues/2/details",
      dueThisWeek: false,
    },
    {
      id: "i3",
      key: "WEB-3",
      title: "Third",
      projectName: "Web",
      href: "/projects/WEB/issues/3/details",
      dueThisWeek: true,
    },
  ];

  it("mounts the stat cards then Assigned to you after the greeting, each in its own Suspense with its own skeleton", async () => {
    requireActorMock.mockResolvedValue(actor);
    const { default: HomePage } = await import("./page");

    const result = await HomePage();
    const [cards, assignedTo] = suspenseBoundaries(result);

    expect(mountedName(cards.props.children)).toBe("StatCards");
    expect(mountedName(cards.props.fallback)).toBe("StatCardsSkeleton");
    expect(mountedName(assignedTo.props.children)).toBe("AssignedSection");
    expect(mountedName(assignedTo.props.fallback)).toBe("AssignedSkeleton");

    const names = typeNames(result);

    expect(names.indexOf("StatCards")).toBeGreaterThan(names.indexOf("p"));
    expect(names.indexOf("AssignedSection")).toBeGreaterThan(names.indexOf("StatCards"));
  });

  it("mounts both surfaces below the awaited requireActor(), on the actor's own id", async () => {
    requireActorMock.mockResolvedValue(actor);
    const { default: HomePage } = await import("./page");

    const [cards, assignedTo] = suspenseBoundaries(await HomePage());

    expect(elements(cards.props.children)[0].props).toMatchObject({ userId: actor.id });
    expect(elements(assignedTo.props.children)[0].props).toMatchObject({ userId: actor.id });
  });

  it("shows the same number on the assigned card as the section lists rows", async () => {
    requireActorMock.mockResolvedValue(actor);
    listAssignedIssuesMock.mockResolvedValue(assigned);
    countUnreadNotificationsMock.mockResolvedValue(0);
    const { default: HomePage } = await import("./page");

    const [cards, assignedTo] = suspenseBoundaries(await HomePage());
    const cardsTree = await renderSurface(cards.props.children);
    const assignedTree = await renderSurface(assignedTo.props.children);

    const rows = typeNames(assignedTree).filter((name) => name === "AssignedIssueRow").length;

    expect(rows).toBe(assigned.length);
    expect(statCardCount(cardsTree, "Assigned to you")).toBe(String(rows));
    expect(statCardCount(cardsTree, "Due this week")).toBe("2");
    expect(statCardCount(cardsTree, "Unread")).toBe("0");
  });
});

describe("/home US2 wiring (FR-001, FR-038)", () => {
  it("mounts Your projects in its own Suspense with its own skeleton, after Assigned to you", async () => {
    requireActorMock.mockResolvedValue(actor);
    const { default: HomePage } = await import("./page");

    const result = await HomePage();
    const projects = suspenseBoundaries(result)[2];

    expect(mountedName(projects.props.children)).toBe("ProjectsSection");
    expect(mountedName(projects.props.fallback)).toBe("ProjectsSkeleton");
    expect(elements(projects.props.children)[0].props).toMatchObject({ userId: actor.id });

    const names = typeNames(result);

    expect(names.indexOf("ProjectsSection")).toBeGreaterThan(names.indexOf("AssignedSection"));
  });
});

describe("/home US3 wiring (FR-001, FR-038)", () => {
  it("mounts Mentions in its own Suspense with its own skeleton, after Your projects", async () => {
    requireActorMock.mockResolvedValue(actor);
    const { default: HomePage } = await import("./page");

    const result = await HomePage();
    const mentions = suspenseBoundaries(result)[3];

    expect(mountedName(mentions.props.children)).toBe("MentionsSection");
    expect(mountedName(mentions.props.fallback)).toBe("MentionsSkeleton");
    expect(elements(mentions.props.children)[0].props).toMatchObject({ userId: actor.id });

    const names = typeNames(result);

    expect(names.indexOf("MentionsSection")).toBeGreaterThan(names.indexOf("ProjectsSection"));
  });
});
describe("/home US4 wiring (FR-001, FR-038)", () => {
  it("mounts Recent activity last, in its own Suspense with its own skeleton, after Mentions", async () => {
    requireActorMock.mockResolvedValue(actor);
    const { default: HomePage } = await import("./page");

    const result = await HomePage();
    const boundaries = suspenseBoundaries(result);
    const activity = boundaries[4];

    expect(boundaries).toHaveLength(5);
    expect(mountedName(activity.props.children)).toBe("ActivitySection");
    expect(mountedName(activity.props.fallback)).toBe("ActivitySkeleton");

    const names = typeNames(result);

    expect(names.indexOf("ActivitySection")).toBeGreaterThan(names.indexOf("MentionsSection"));
    expect(names.at(-1)).toBe("ActivitySection");
  });
});