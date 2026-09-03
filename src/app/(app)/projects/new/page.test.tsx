import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/auth/server/actor", () => ({
  requireActor: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  forbidden: vi.fn(() => {
    throw new Error("NEXT_FORBIDDEN");
  }),
}));
vi.mock("@/features/projects/server/queries", () => ({
  listAddableUsers: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/features/projects/actions", () => ({
  createProject: vi.fn(),
  checkProjectKeyAvailable: vi.fn(),
}));

import { forbidden } from "next/navigation";
import { requireActor } from "@/features/auth/server/actor";
import { listAddableUsers } from "@/features/projects/server/queries";
import NewProjectPage from "./page";

afterEach(() => {
  vi.clearAllMocks();
});

describe("/projects/new page (FR-022, FR-023, OT-SEC-015)", () => {
  it("redirects an unauthenticated caller to /signin and never reaches Forbidden", async () => {
    vi.mocked(requireActor).mockImplementation(() => {
      throw new Error("NEXT_REDIRECT:/signin");
    });

    await expect(NewProjectPage()).rejects.toThrow("NEXT_REDIRECT:/signin");
    expect(forbidden).not.toHaveBeenCalled();
  });

  it("gives a signed-in member the Forbidden screen at this URL", async () => {
    vi.mocked(requireActor).mockResolvedValue({
      id: "member-1",
      role: "member",
      firstName: "Ada",
      lastName: "Lovelace",
      avatarUrl: null,
      mustChangePassword: false,
    });

    await expect(NewProjectPage()).rejects.toThrow("NEXT_FORBIDDEN");
    expect(forbidden).toHaveBeenCalled();
  });

  it("renders the create-project form for a signed-in admin, excluding the actor from candidates", async () => {
    vi.mocked(requireActor).mockResolvedValue({
      id: "admin-1",
      role: "admin",
      firstName: "Ada",
      lastName: "Lovelace",
      avatarUrl: null,
      mustChangePassword: false,
    });

    const jsx = await NewProjectPage();

    expect(jsx).toBeDefined();
    expect(forbidden).not.toHaveBeenCalled();
    expect(listAddableUsers).toHaveBeenCalledWith({ excludeUserId: "admin-1" });
  });
});