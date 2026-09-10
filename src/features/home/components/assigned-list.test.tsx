import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { AssignedIssueRow } from "../server/assigned-queries";
import { AssignedList } from "./assigned-list";

function issue(
  overrides: Partial<AssignedIssueRow> & { id: string; column: AssignedIssueRow["column"] },
): AssignedIssueRow {
  return {
    key: "APOLLO-1",
    title: "Untitled",
    projectKey: "APOLLO",
    projectName: "Apollo Platform",
    href: "/projects/APOLLO/issues/1/details",
    dueThisWeek: false,
    priority: "none",
    dueDate: null,
    label: null,
    ...overrides,
  };
}

const TODO = { id: "col-todo", name: "Todo", kind: "open" as const, sortOrder: "a1" };
const IN_PROGRESS = { id: "col-progress", name: "In Progress", kind: "open" as const, sortOrder: "a2" };

describe("AssignedList", () => {
  it("groups issues under their column heading with a count", () => {
    render(
      <AssignedList
        issues={[
          issue({ id: "1", column: TODO, title: "First todo" }),
          issue({ id: "2", column: IN_PROGRESS, title: "In flight" }),
        ]}
        totalOpenCount={42}
      />,
    );

    expect(screen.getByText("Todo")).toBeTruthy();
    expect(screen.getByText("In Progress")).toBeTruthy();
    expect(screen.getByText("First todo")).toBeTruthy();
    expect(screen.getByText("In flight")).toBeTruthy();
  });

  it("shows the 'Open in list' action once, on the first group", () => {
    render(
      <AssignedList
        issues={[issue({ id: "1", column: TODO }), issue({ id: "2", column: IN_PROGRESS })]}
        totalOpenCount={42}
      />,
    );

    expect(screen.getAllByRole("link", { name: "Open in list" })).toHaveLength(1);
  });

  it("shows a label pill only when the issue carries one", () => {
    render(
      <AssignedList
        issues={[issue({ id: "1", column: TODO, label: "blocked" })]}
        totalOpenCount={5}
      />,
    );

    expect(screen.getByText("blocked")).toBeTruthy();
  });

  it("links to the all-open-issues view with the team's total count", () => {
    render(
      <AssignedList
        issues={[issue({ id: "1", column: TODO })]}
        totalOpenCount={42}
      />,
    );

    expect(screen.getByRole("link", { name: "All 42 open issues →" })).toBeTruthy();
  });
});