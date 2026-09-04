import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/auth/server/actor", () => ({
  requireActor: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("@/features/projects/server/queries", () => ({
  loadProjectDetails: vi.fn(),
  loadProjectByKey: vi.fn(),
}));
vi.mock("@/features/projects/actions", () => ({
  updateProject: vi.fn(),
}));
vi.mock("@/features/activity/server/feed-queries", () => ({
  listFeed: vi.fn().mockResolvedValue({ rows: [], hasNextPage: false }),
  countProjectComments: vi.fn().mockResolvedValue(0),
}));
vi.mock("@/features/activity/server/feed-filter", () => ({
  getFeedFilter: vi.fn().mockResolvedValue("all"),
}));

import { notFound } from "next/navigation";
import { countProjectComments } from "@/features/activity/server/feed-queries";
import { requireActor } from "@/features/auth/server/actor";
import { NewIssueControl } from "@/features/issues/components/new-issue-control";
import { updateProject } from "@/features/projects/actions";
import { loadProjectByKey, loadProjectDetails } from "@/features/projects/server/queries";
import ProjectDetailsPage from "./page";

const ACTOR = {
  id: "member-1",
  role: "member",
  firstName: "Ada",
  lastName: "Lovelace",
  avatarUrl: null,
  mustChangePassword: false,
};

const PROJECT_ROW = {
  id: "project-1",
  key: "WR",
  name: "Website Redesign",
  description: null,
  status: "active" as const,
  startDate: null,
  targetDate: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const DETAILS = {
  record: {
    key: "WR",
    name: "Website Redesign",
    description: null,
    status: "active" as const,
    startDate: null,
    targetDate: null,
  },
  columns: [],
  roster: [],
  cascadeCount: 0,
  canEditRecord: true,
  canAdminister: false,
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("/projects/:projectKey/details page (FR-035, FR-040)", () => {
  it("redirects an unauthenticated caller to /signin and never loads a project", async () => {
    vi.mocked(requireActor).mockImplementation(() => {
      throw new Error("NEXT_REDIRECT:/signin");
    });

    await expect(ProjectDetailsPage({ params: Promise.resolve({ projectKey: "WR" }) })).rejects.toThrow(
      "NEXT_REDIRECT:/signin",
    );
    expect(loadProjectDetails).not.toHaveBeenCalled();
  });

  it("renders 'This doesn't exist' for a key that matches no project", async () => {
    vi.mocked(requireActor).mockResolvedValue(ACTOR);
    vi.mocked(loadProjectDetails).mockResolvedValue(null);

    await expect(ProjectDetailsPage({ params: Promise.resolve({ projectKey: "NOPE" }) })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    expect(notFound).toHaveBeenCalled();
  });

  it("renders the details screen for a signed-in user reading an existing project", async () => {
    vi.mocked(requireActor).mockResolvedValue(ACTOR);
    vi.mocked(loadProjectDetails).mockResolvedValue(DETAILS);
    vi.mocked(loadProjectByKey).mockResolvedValue(PROJECT_ROW);

    const jsx = await ProjectDetailsPage({ params: Promise.resolve({ projectKey: "WR" }) });

    expect(jsx).toBeDefined();
    expect(loadProjectDetails).toHaveBeenCalledWith("WR", ACTOR);
    expect(notFound).not.toHaveBeenCalled();
    expect(jsx.props.details).toBe(DETAILS);
    expect(jsx.props.updateProjectAction).toBe(updateProject);
  });

  it("reads the project's own live comment count and passes it to the screen (FR-059)", async () => {
    vi.mocked(requireActor).mockResolvedValue(ACTOR);
    vi.mocked(loadProjectDetails).mockResolvedValue(DETAILS);
    vi.mocked(loadProjectByKey).mockResolvedValue(PROJECT_ROW);
    vi.mocked(countProjectComments).mockResolvedValue(5);

    const jsx = await ProjectDetailsPage({ params: Promise.resolve({ projectKey: "WR" }) });

    expect(countProjectComments).toHaveBeenCalledWith(PROJECT_ROW.id);
    expect(jsx.props.commentCount).toBe(5);
  });

  it("wires the header's New issue control, enabled for a member of the project (FR-028)", async () => {
    vi.mocked(requireActor).mockResolvedValue(ACTOR);
    vi.mocked(loadProjectDetails).mockResolvedValue(DETAILS);
    vi.mocked(loadProjectByKey).mockResolvedValue(PROJECT_ROW);

    const jsx = await ProjectDetailsPage({ params: Promise.resolve({ projectKey: "WR" }) });

    expect(jsx.props.newIssue.type).toBe(NewIssueControl);
    expect(jsx.props.newIssue.props.projectKey).toBe("WR");
    expect(jsx.props.newIssue.props.canWrite).toBe(true);
    expect(jsx.props.newIssue.props.writeReason).toBe("");
  });

  it("disables the header's New issue control with a reason for a non-member", async () => {
    vi.mocked(requireActor).mockResolvedValue(ACTOR);
    vi.mocked(loadProjectDetails).mockResolvedValue({ ...DETAILS, canEditRecord: false });
    vi.mocked(loadProjectByKey).mockResolvedValue(PROJECT_ROW);

    const jsx = await ProjectDetailsPage({ params: Promise.resolve({ projectKey: "WR" }) });

    expect(jsx.props.newIssue.props.canWrite).toBe(false);
    expect(jsx.props.newIssue.props.writeReason).toBe(
      "Only project members can create issues in Website Redesign.",
    );
  });
});