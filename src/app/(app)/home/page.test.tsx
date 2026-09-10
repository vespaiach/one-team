import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { requireActor } = vi.hoisted(() => ({ requireActor: vi.fn() }));
vi.mock("@/features/auth/server/actor", () => ({ requireActor }));

const { hasAnyProject } = vi.hoisted(() => ({ hasAnyProject: vi.fn() }));
vi.mock("@/features/home/server/project-queries", () => ({ hasAnyProject }));

const { listAddableUsers } = vi.hoisted(() => ({ listAddableUsers: vi.fn() }));
vi.mock("@/features/projects/server/queries", () => ({
  listAddableUsers,
  listProjectsForSidebar: vi.fn(),
}));

const HomePage = (await import("./page")).default;

describe("HomePage", () => {
  it("shows the New workspace state when the installation has no projects yet", async () => {
    requireActor.mockResolvedValue({ id: "user-1", firstName: "Ada", role: "member" });
    hasAnyProject.mockResolvedValue(false);
    listAddableUsers.mockResolvedValue([]);

    render(await HomePage());

    expect(screen.getByText("Nothing filed yet")).toBeTruthy();
    expect(screen.getByText(/Good (morning|afternoon|evening), Ada/)).toBeTruthy();
  });

  it("offers admin actions in the New workspace state for an admin viewer", async () => {
    requireActor.mockResolvedValue({ id: "user-1", firstName: "Ada", role: "admin" });
    hasAnyProject.mockResolvedValue(false);
    listAddableUsers.mockResolvedValue([]);

    render(await HomePage());

    expect(screen.getByRole("button", { name: "New project" })).toBeTruthy();
  });
});