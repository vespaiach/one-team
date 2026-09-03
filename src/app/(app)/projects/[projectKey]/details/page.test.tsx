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
}));
vi.mock("@/features/projects/actions", () => ({
  updateProject: vi.fn(),
}));

import { notFound } from "next/navigation";
import { requireActor } from "@/features/auth/server/actor";
import { updateProject } from "@/features/projects/actions";
import { loadProjectDetails } from "@/features/projects/server/queries";
import ProjectDetailsPage from "./page";

const ACTOR = {
  id: "member-1",
  role: "member",
  firstName: "Ada",
  lastName: "Lovelace",
  avatarUrl: null,
  mustChangePassword: false,
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

    const jsx = await ProjectDetailsPage({ params: Promise.resolve({ projectKey: "WR" }) });

    expect(jsx).toBeDefined();
    expect(loadProjectDetails).toHaveBeenCalledWith("WR", ACTOR);
    expect(notFound).not.toHaveBeenCalled();
    expect(jsx.props.details).toBe(DETAILS);
    expect(jsx.props.updateProjectAction).toBe(updateProject);
  });
});