import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AssignedIssueRow } from "../server/assigned-queries";

const { listAssignedIssues } = vi.hoisted(() => ({ listAssignedIssues: vi.fn() }));
vi.mock("../server/assigned-queries", () => ({ listAssignedIssues }));

const { AssignedSection } = await import("./assigned-section");

const PROJECTS = [{ key: "APOLLO", name: "Apollo Platform", status: "active" as const }];

function issue(overrides: Partial<AssignedIssueRow> = {}): AssignedIssueRow {
  return {
    id: "1",
    key: "APOLLO-1",
    title: "Untitled",
    projectKey: "APOLLO",
    projectName: "Apollo Platform",
    href: "/projects/APOLLO/issues/1/details",
    dueThisWeek: false,
    priority: "none",
    dueDate: null,
    label: null,
    column: { id: "col-1", name: "Todo", kind: "open", sortOrder: "a1" },
    ...overrides,
  };
}

describe("AssignedSection", () => {
  it("renders the empty state when nothing is assigned", async () => {
    listAssignedIssues.mockResolvedValue([]);

    render(
      await AssignedSection({
        userId: "user-1",
        projects: PROJECTS,
        totalOpenCount: 9,
      }),
    );

    expect(screen.getByText("Your queue is clear")).toBeTruthy();
  });

  it("renders the grouped list when issues are assigned", async () => {
    listAssignedIssues.mockResolvedValue([issue({ title: "Fix the flux capacitor" })]);

    render(
      await AssignedSection({
        userId: "user-1",
        projects: PROJECTS,
        totalOpenCount: 9,
      }),
    );

    expect(screen.getByText("Fix the flux capacitor")).toBeTruthy();
  });
});