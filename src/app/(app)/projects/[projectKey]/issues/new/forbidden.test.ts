import type { ReactElement } from "react";
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

import { forbidden } from "next/navigation";
import { requireActor } from "@/features/auth/server/actor";
import { NewIssueControl } from "@/features/issues/components/new-issue-control";
import { isMember } from "@/features/projects/server/authorization";
import { loadProjectByKey } from "@/features/projects/server/queries";
import { ScreenHeader } from "@/features/shell/components/screen-header";
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

function findScreenHeader(node: ReactElement): ReactElement | null {
  if (node.type === ScreenHeader) {
    return node;
  }
  const children = (node.props as { children?: unknown }).children;
  const candidates = Array.isArray(children) ? children : [children];
  for (const candidate of candidates) {
    if (candidate && typeof candidate === "object" && "type" in candidate) {
      const found = findScreenHeader(candidate as ReactElement);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("/projects/:projectKey/issues/new — the route refusal is independent of the disabled control (FR-029, SC-007, US4 s4)", () => {
  it("redirects an unauthenticated caller to /signin and never reaches Forbidden", async () => {
    vi.mocked(requireActor).mockImplementation(() => {
      throw new Error("NEXT_REDIRECT:/signin");
    });

    await expect(NewIssuePage(params("WEB"))).rejects.toThrow("NEXT_REDIRECT:/signin");
    expect(forbidden).not.toHaveBeenCalled();
    expect(loadProjectByKey).not.toHaveBeenCalled();
  });

  it("gives a signed-in non-member the Forbidden screen when they reach the route by deep link", async () => {
    vi.mocked(requireActor).mockResolvedValue(ACTOR);
    vi.mocked(loadProjectByKey).mockResolvedValue(PROJECT);
    vi.mocked(isMember).mockResolvedValue(false);

    await expect(NewIssuePage(params("WEB"))).rejects.toThrow("NEXT_FORBIDDEN");
    expect(forbidden).toHaveBeenCalled();
  });

  it("renders the header's New issue control pointing at this same route for a signed-in member", async () => {
    vi.mocked(requireActor).mockResolvedValue(ACTOR);
    vi.mocked(loadProjectByKey).mockResolvedValue(PROJECT);
    vi.mocked(isMember).mockResolvedValue(true);

    const jsx = (await NewIssuePage(params("WEB"))) as ReactElement;

    const header = findScreenHeader(jsx);
    expect(header).not.toBeNull();
    const newIssue = (header?.props as { newIssue?: ReactElement }).newIssue;
    expect(newIssue?.type).toBe(NewIssueControl);
    expect((newIssue?.props as { projectKey?: string }).projectKey).toBe("WEB");
    expect((newIssue?.props as { canWrite?: boolean }).canWrite).toBe(true);
  });
});