import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/auth/server/actor", () => ({
  requireActor: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("@/features/issues/server/issue-queries", () => ({
  loadIssueView: vi.fn(),
}));

import { notFound } from "next/navigation";
import { requireActor } from "@/features/auth/server/actor";
import { loadIssueView } from "@/features/issues/server/issue-queries";
import IssueDetailsPage from "./page";

const ACTOR = {
  id: "member-1",
  role: "member",
  firstName: "Ada",
  lastName: "Lovelace",
  avatarUrl: null,
  mustChangePassword: false,
};

const NON_MEMBER_ACTOR = {
  id: "outsider-1",
  role: "member",
  firstName: "Not",
  lastName: "Here",
  avatarUrl: null,
  mustChangePassword: false,
};

const ISSUE_VIEW = {
  id: "issue-1",
  key: "WEB-142",
  number: 142,
  title: "Fix the header",
  description: null,
  column: { id: "col-1", name: "Backlog" },
  priority: "none" as const,
  assignee: null,
  dueDate: null,
  project: { key: "WEB", name: "Website Redesign" },
  createdBy: {
    id: "member-1",
    firstName: "Ada",
    lastName: "Lovelace",
    avatarUrl: null,
    role: "member",
    jobTitle: null,
    deactivatedAt: null,
  },
  createdAt: new Date(),
  updatedAt: new Date(),
};

function params(projectKey: string, issueNumber: string) {
  return { params: Promise.resolve({ projectKey, issueNumber }) };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("/projects/:projectKey/issues/:issueNumber/details page (FR-041, FR-046, SC-014, US2 s4, s6)", () => {
  it("redirects an unauthenticated caller to /signin and resolves no issue", async () => {
    vi.mocked(requireActor).mockImplementation(() => {
      throw new Error("NEXT_REDIRECT:/signin");
    });

    await expect(IssueDetailsPage(params("WEB", "142"))).rejects.toThrow("NEXT_REDIRECT:/signin");
    expect(loadIssueView).not.toHaveBeenCalled();
  });

  it("answers 'This doesn't exist' for a project key and issue number matching nothing", async () => {
    vi.mocked(requireActor).mockResolvedValue(ACTOR);
    vi.mocked(loadIssueView).mockResolvedValue(null);

    await expect(IssueDetailsPage(params("NOPE", "142"))).rejects.toThrow("NEXT_NOT_FOUND");

    expect(notFound).toHaveBeenCalled();
  });

  it("answers 'This doesn't exist' for a malformed issue number, without querying", async () => {
    vi.mocked(requireActor).mockResolvedValue(ACTOR);

    await expect(IssueDetailsPage(params("WEB", "not-a-number"))).rejects.toThrow("NEXT_NOT_FOUND");

    expect(loadIssueView).not.toHaveBeenCalled();
  });

  it("resolves the issue from the pair of project key and issue number", async () => {
    vi.mocked(requireActor).mockResolvedValue(ACTOR);
    vi.mocked(loadIssueView).mockResolvedValue(ISSUE_VIEW);

    await IssueDetailsPage(params("WEB", "142"));

    expect(loadIssueView).toHaveBeenCalledWith("WEB", 142);
  });

  it("renders the issue for any signed-in user, including a non-member, with no Forbidden path", async () => {
    vi.mocked(requireActor).mockResolvedValue(NON_MEMBER_ACTOR);
    vi.mocked(loadIssueView).mockResolvedValue(ISSUE_VIEW);

    const jsx = await IssueDetailsPage(params("WEB", "142"));

    expect(jsx).toBeDefined();
    expect(notFound).not.toHaveBeenCalled();
  });
});