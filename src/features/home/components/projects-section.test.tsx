import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ProjectProgressRow } from "../server/project-queries";

const { listMemberProjectsWithProgress } = vi.hoisted(() => ({
  listMemberProjectsWithProgress: vi.fn(),
}));
vi.mock("../server/project-queries", () => ({ listMemberProjectsWithProgress }));

const { ProjectsSection } = await import("./projects-section");

function project(overrides: Partial<ProjectProgressRow> = {}): ProjectProgressRow {
  return {
    key: "APOLLO",
    name: "Apollo Platform",
    status: "active",
    href: "/projects/APOLLO",
    done: 1,
    counted: 2,
    openCount: 1,
    targetDate: null,
    targetPassed: false,
    members: [],
    ...overrides,
  };
}

describe("ProjectsSection", () => {
  it("shows the project count and a card per project", async () => {
    listMemberProjectsWithProgress.mockResolvedValue([
      project(),
      project({ key: "APP", name: "Workspace App" }),
    ]);

    render(await ProjectsSection({ userId: "user-1" }));

    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("Apollo Platform")).toBeTruthy();
    expect(screen.getByText("Workspace App")).toBeTruthy();
  });

  it("shows a placeholder when the viewer belongs to no project", async () => {
    listMemberProjectsWithProgress.mockResolvedValue([]);

    render(await ProjectsSection({ userId: "user-1" }));

    expect(screen.getByText("No projects yet.")).toBeTruthy();
  });
});