import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../server/project-queries", () => ({
  listMemberProjectsWithProgress: vi.fn(),
}));

import type { ProjectProgressRow } from "../server/project-queries";
import { listMemberProjectsWithProgress } from "../server/project-queries";
import { ProjectsSection } from "./projects-section";

afterEach(() => {
  vi.clearAllMocks();
});

function row(index: number): ProjectProgressRow {
  return {
    key: `P${index}`,
    name: `Project ${index}`,
    status: "active",
    href: `/projects/P${index}`,
    done: index,
    counted: 10,
  };
}

describe("ProjectsSection (FR-014, FR-040, SC-010)", () => {
  it("is a labelled region carrying its own heading", async () => {
    vi.mocked(listMemberProjectsWithProgress).mockResolvedValue([row(1)]);

    render(await ProjectsSection({ userId: "u1" }));

    const region = screen.getByRole("region", { name: "Your projects" });
    expect(within(region).getByRole("heading", { name: "Your projects" })).not.toBeNull();
  });

  it("renders one row per project the query returns", async () => {
    vi.mocked(listMemberProjectsWithProgress).mockResolvedValue([row(1), row(2), row(3)]);

    render(await ProjectsSection({ userId: "u1" }));

    const region = screen.getByRole("region", { name: "Your projects" });
    expect(within(region).getAllByRole("link")).toHaveLength(3);
    expect(within(region).getByText("Project 2")).not.toBeNull();
  });

  it("reads the viewer's own projects", async () => {
    vi.mocked(listMemberProjectsWithProgress).mockResolvedValue([]);

    render(await ProjectsSection({ userId: "u1" }));

    expect(listMemberProjectsWithProgress).toHaveBeenCalledWith("u1");
  });

  it("renders exactly one quiet line when empty — no illustration and no call to action", async () => {
    vi.mocked(listMemberProjectsWithProgress).mockResolvedValue([]);

    const { container } = render(await ProjectsSection({ userId: "u1" }));

    const region = screen.getByRole("region", { name: "Your projects" });
    expect(within(region).queryAllByRole("link")).toHaveLength(0);
    expect(within(region).queryAllByRole("button")).toHaveLength(0);
    expect(within(region).queryAllByRole("listitem")).toHaveLength(0);
    expect(container.querySelectorAll("img, svg")).toHaveLength(0);
    expect(container.querySelectorAll("p")).toHaveLength(1);
  });
});