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

import { forbidden, notFound } from "next/navigation";
import { requireActor } from "@/features/auth/server/actor";
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