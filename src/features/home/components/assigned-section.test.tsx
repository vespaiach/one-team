import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../server/assigned-queries", () => ({
  listAssignedIssues: vi.fn(),
}));

import type { AssignedIssueRow } from "../server/assigned-queries";
import { listAssignedIssues } from "../server/assigned-queries";
import { AssignedSection } from "./assigned-section";

afterEach(() => {
  vi.clearAllMocks();
});

function assignedRow(index: number): AssignedIssueRow {
  return {
    id: `i${index}`,
    key: `WEB-${index}`,
    title: `Issue ${index}`,
    projectName: "Website Redesign",
    href: `/projects/WEB/issues/${index}/details`,
    dueThisWeek: false,
    priority: "none",
    dueDate: null,
  };
}

describe("AssignedSection is a labelled region with a heading (FR-042, screens §4)", () => {
  it("names itself Assigned to you, so the surface is navigable by heading", async () => {
    vi.mocked(listAssignedIssues).mockResolvedValue([assignedRow(1)]);

    render(await AssignedSection({ userId: "u1" }));

    expect(screen.getByRole("region", { name: "Assigned to you" })).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Assigned to you" })).not.toBeNull();
  });
});

describe("AssignedSection truncates nothing (FR-010)", () => {
  it("renders one row per assigned issue, however many the viewer holds", async () => {
    const rows = Array.from({ length: 105 }, (_, index) => assignedRow(index + 1));
    vi.mocked(listAssignedIssues).mockResolvedValue(rows);

    const { container } = render(await AssignedSection({ userId: "u1" }));

    expect(listAssignedIssues).toHaveBeenCalledWith("u1");
    expect(container.querySelectorAll("li")).toHaveLength(105);
    expect(screen.getAllByRole("link")).toHaveLength(105);
    expect(screen.getByText("WEB-105")).not.toBeNull();
  });
});

describe("AssignedSection says the empty case in one quiet line (FR-040, SC-010, US1 s6)", () => {
  it("renders exactly one line of text and no illustration, link or call to action", async () => {
    vi.mocked(listAssignedIssues).mockResolvedValue([]);

    const { container } = render(await AssignedSection({ userId: "u1" }));

    expect(container.querySelectorAll("p")).toHaveLength(1);
    expect(container.querySelectorAll("li")).toHaveLength(0);
    expect(container.querySelectorAll("img, svg")).toHaveLength(0);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });
});