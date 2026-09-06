import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/auth/server/actor", () => ({
  requireActor: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  forbidden: vi.fn(() => {
    throw new Error("NEXT_FORBIDDEN");
  }),
}));
vi.mock("@/features/projects/server/queries", () => ({
  loadProjectByKey: vi.fn(),
}));
vi.mock("@/features/projects/server/authorization", () => ({
  isMember: vi.fn(),
}));
vi.mock("@/features/issues/server/issue-queries", () => ({
  listProjectColumns: vi.fn().mockResolvedValue([]),
  listAssigneePool: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/features/issues/actions", () => ({
  createIssue: vi.fn(),
}));
vi.mock("@/features/labels/server/queries", () => ({
  listLabelOptionsForIssue: vi.fn().mockResolvedValue([]),
}));

import { forbidden, notFound } from "next/navigation";
import { isValidElement, type ReactElement, type ReactNode, Suspense } from "react";
import { requireActor } from "@/features/auth/server/actor";
import { CreateIssueForm } from "@/features/issues/components/create-issue-form";
import { listAssigneePool, listProjectColumns } from "@/features/issues/server/issue-queries";
import { isMember } from "@/features/projects/server/authorization";
import { loadProjectByKey } from "@/features/projects/server/queries";
import NewIssuePage from "./page";

const ACTOR = {
  id: "member-1",
  role: "member",
  firstName: "Ada",
  lastName: "Lovelace",
  avatarUrl: null,
  mustChangePassword: false,
};

const PROJECT = {
  id: "project-1",
  key: "WEB",
  name: "Website Redesign",
  description: null,
  status: "active" as const,
  startDate: null,
  targetDate: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function params(projectKey: string) {
  return { params: Promise.resolve({ projectKey }) };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("/projects/:projectKey/issues/new page (FR-027, FR-029, FR-046, research D-1)", () => {
  it("redirects an unauthenticated caller to /signin and resolves no project", async () => {
    vi.mocked(requireActor).mockImplementation(() => {
      throw new Error("NEXT_REDIRECT:/signin");
    });

    await expect(NewIssuePage(params("WEB"))).rejects.toThrow("NEXT_REDIRECT:/signin");
    expect(loadProjectByKey).not.toHaveBeenCalled();
  });

  it("runs requireActor() before resolving the project", async () => {
    const order: string[] = [];
    vi.mocked(requireActor).mockImplementation(async () => {
      order.push("requireActor");
      return ACTOR;
    });
    vi.mocked(loadProjectByKey).mockImplementation(async () => {
      order.push("loadProjectByKey");
      return PROJECT;
    });
    vi.mocked(isMember).mockResolvedValue(true);

    await NewIssuePage(params("WEB"));

    expect(order).toEqual(["requireActor", "loadProjectByKey"]);
  });

  it("answers 'This doesn't exist' for a project key that matches nothing, and never runs isMember", async () => {
    vi.mocked(requireActor).mockResolvedValue(ACTOR);
    vi.mocked(loadProjectByKey).mockResolvedValue(null);

    await expect(NewIssuePage(params("NOPE"))).rejects.toThrow("NEXT_NOT_FOUND");

    expect(notFound).toHaveBeenCalled();
    expect(isMember).not.toHaveBeenCalled();
  });

  it("existence is decided before authorization: isMember only runs once the project has resolved", async () => {
    vi.mocked(requireActor).mockResolvedValue(ACTOR);
    let projectResolved = false;
    vi.mocked(loadProjectByKey).mockImplementation(async () => {
      projectResolved = true;
      return PROJECT;
    });
    vi.mocked(isMember).mockImplementation(async () => {
      expect(projectResolved).toBe(true);
      return true;
    });

    await NewIssuePage(params("WEB"));

    expect(isMember).toHaveBeenCalledWith(ACTOR, PROJECT.id);
  });

  it("gives a signed-in non-member the Forbidden screen at this URL", async () => {
    vi.mocked(requireActor).mockResolvedValue(ACTOR);
    vi.mocked(loadProjectByKey).mockResolvedValue(PROJECT);
    vi.mocked(isMember).mockResolvedValue(false);

    await expect(NewIssuePage(params("WEB"))).rejects.toThrow("NEXT_FORBIDDEN");

    expect(forbidden).toHaveBeenCalled();
  });

  it("renders the create-issue form for a signed-in member of the project", async () => {
    vi.mocked(requireActor).mockResolvedValue(ACTOR);
    vi.mocked(loadProjectByKey).mockResolvedValue(PROJECT);
    vi.mocked(isMember).mockResolvedValue(true);

    const jsx = await NewIssuePage(params("WEB"));

    expect(jsx).toBeDefined();
    expect(forbidden).not.toHaveBeenCalled();
    expect(notFound).not.toHaveBeenCalled();
  });
});

const COLUMNS = [
  { id: "0198d2b1-0000-7000-8000-0000000000c1", name: "Backlog" },
  { id: "0198d2b1-0000-7000-8000-0000000000c2", name: "In progress" },
];

const POOL = [
  {
    id: "0198d2b1-0000-7000-8000-0000000000a1",
    firstName: "Ada",
    lastName: "Lovelace",
    avatarUrl: null,
    jobTitle: null,
  },
];

function pageProps(projectKey: string, query: Record<string, string | string[]>) {
  return {
    params: Promise.resolve({ projectKey }),
    searchParams: Promise.resolve(query),
  };
}

function elements(node: ReactNode): ReactElement<{ children?: ReactNode }>[] {
  if (Array.isArray(node)) {
    return node.flatMap(elements);
  }
  if (!isValidElement(node)) {
    return [];
  }
  const element = node as ReactElement<{ children?: ReactNode }>;
  return [element, ...elements(element.props.children)];
}

function findByType(node: ReactNode, type: unknown): ReactElement<Record<string, unknown>> | undefined {
  return elements(node).find((element) => element.type === type) as
    | ReactElement<Record<string, unknown>>
    | undefined;
}

async function formPropsFor(query: Record<string, string | string[]>): Promise<Record<string, unknown>> {
  vi.mocked(requireActor).mockResolvedValue(ACTOR);
  vi.mocked(loadProjectByKey).mockResolvedValue(PROJECT);
  vi.mocked(isMember).mockResolvedValue(true);
  vi.mocked(listProjectColumns).mockResolvedValue(COLUMNS);
  vi.mocked(listAssigneePool).mockResolvedValue(POOL);

  const boundary = findByType(await NewIssuePage(pageProps("WEB", query)), Suspense);
  const child = boundary?.props.children;
  if (!isValidElement(child) || typeof child.type !== "function") {
    throw new Error("the create-issue form data boundary is not a component");
  }
  const renderFormData = child.type as (props: unknown) => Promise<ReactNode>;
  const form = findByType(await renderFormData(child.props), CreateIssueForm);
  if (!form) {
    throw new Error("no CreateIssueForm was rendered");
  }
  return form.props;
}

describe("/projects/:projectKey/issues/new preselection from searchParams (FR-048, FR-053, II, gate 3)", () => {
  it("preselects a column the project actually has", async () => {
    const props = await formPropsFor({ columnId: COLUMNS[1].id });

    expect(props.initialColumnId).toBe(COLUMNS[1].id);
  });

  it("drops a columnId naming another project's column and leaves the form its own default", async () => {
    const props = await formPropsFor({ columnId: "0198d2b1-0000-7000-8000-00000000ffff" });

    expect(props.initialColumnId).toBeUndefined();
  });

  it("preselects an assignee who is in the pool", async () => {
    const props = await formPropsFor({ assigneeId: POOL[0].id });

    expect(props.initialAssigneeId).toBe(POOL[0].id);
  });

  it("drops an assigneeId outside the assignee pool", async () => {
    const props = await formPropsFor({ assigneeId: "0198d2b1-0000-7000-8000-00000000eeee" });

    expect(props.initialAssigneeId).toBeUndefined();
  });

  it("preselects a priority parsePriority admits, and drops one it does not", async () => {
    expect((await formPropsFor({ priority: "high" })).initialPriority).toBe("high");
    expect((await formPropsFor({ priority: "critical" })).initialPriority).toBeUndefined();
  });

  it("carries a typed title through trimmed, and drops one that is blank or too long", async () => {
    expect((await formPropsFor({ title: "  Ship the board  " })).initialTitle).toBe("Ship the board");
    expect((await formPropsFor({ title: "   " })).initialTitle).toBeUndefined();
    expect((await formPropsFor({ title: "x".repeat(201) })).initialTitle).toBeUndefined();
  });

  it("drops a repeated parameter rather than taking one of its values", async () => {
    const props = await formPropsFor({
      columnId: [COLUMNS[0].id, COLUMNS[1].id],
      priority: ["low", "high"],
      title: ["one", "two"],
      assigneeId: [POOL[0].id, POOL[0].id],
    });

    expect(props.initialColumnId).toBeUndefined();
    expect(props.initialAssigneeId).toBeUndefined();
    expect(props.initialPriority).toBeUndefined();
    expect(props.initialTitle).toBeUndefined();
  });

  it("passes no preselection at all when the query string is empty", async () => {
    const props = await formPropsFor({});

    expect(props.initialColumnId).toBeUndefined();
    expect(props.initialAssigneeId).toBeUndefined();
    expect(props.initialPriority).toBeUndefined();
    expect(props.initialTitle).toBeUndefined();
  });

  it("still gives a non-member the Forbidden screen when the URL carries a full preselection", async () => {
    vi.mocked(requireActor).mockResolvedValue(ACTOR);
    vi.mocked(loadProjectByKey).mockResolvedValue(PROJECT);
    vi.mocked(isMember).mockResolvedValue(false);

    await expect(
      NewIssuePage(pageProps("WEB", { columnId: COLUMNS[0].id, priority: "high" })),
    ).rejects.toThrow("NEXT_FORBIDDEN");

    expect(forbidden).toHaveBeenCalled();
    expect(listProjectColumns).not.toHaveBeenCalled();
  });
});