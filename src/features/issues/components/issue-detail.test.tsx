import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { IssueView } from "../server/issue-queries";
import { IssueDetail } from "./issue-detail";

function makeIssueView(overrides: Partial<IssueView> = {}): IssueView {
  const now = new Date("2026-01-15T12:00:00Z");
  return {
    id: "issue-1",
    key: "WEB-142",
    number: 142,
    title: "Fix the header",
    description: "Some description",
    column: { id: "col-1", name: "In progress" },
    priority: "high",
    assignee: {
      id: "user-2",
      firstName: "Alan",
      lastName: "Turing",
      avatarUrl: null,
      role: "member",
      jobTitle: null,
      deactivatedAt: null,
    },
    dueDate: "2026-02-01",
    project: { key: "WEB", name: "Website Redesign" },
    createdBy: {
      id: "user-1",
      firstName: "Grace",
      lastName: "Hopper",
      avatarUrl: null,
      role: "member",
      jobTitle: null,
      deactivatedAt: null,
    },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("IssueDetail — layout (FR-042, FR-043, FR-045, US2 s1)", () => {
  it("renders a main column and a 262px meta rail", () => {
    render(<IssueDetail issue={makeIssueView()} />);

    const rail = screen.getByRole("complementary", { name: "Issue details" });
    expect(rail.className).toContain("262px");
  });

  it("puts the key first in document order, then the title, then the description", () => {
    render(<IssueDetail issue={makeIssueView()} />);

    const key = screen.getByText("WEB-142");
    const title = screen.getByText("Fix the header");
    const description = screen.getByText("Some description");

    expect(key.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(title.compareDocumentPosition(description) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows column, priority, assignee and due date in the rail", () => {
    render(<IssueDetail issue={makeIssueView()} />);

    expect(screen.getByText("In progress")).toBeDefined();
    expect(screen.getByText("High")).toBeDefined();
    expect(screen.getByText("Alan Turing")).toBeDefined();
    expect(screen.getByText("2026-02-01")).toBeDefined();
  });

  it("shows project, created-by and timestamps as values rather than controls", () => {
    const { container } = render(<IssueDetail issue={makeIssueView()} />);

    expect(screen.getByText("Website Redesign")).toBeDefined();
    expect(screen.getByText("Grace Hopper")).toBeDefined();
    expect(container.querySelectorAll("select, input, textarea")).toHaveLength(0);
  });

  it("renders no Activity section and no label control anywhere", () => {
    render(<IssueDetail issue={makeIssueView()} />);

    expect(screen.queryByText(/^activity$/i)).toBeNull();
    expect(screen.queryByText(/^labels?$/i)).toBeNull();
  });
});