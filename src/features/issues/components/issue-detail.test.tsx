import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { AssigneeOption, IssueColumnOption, IssueView } from "../server/issue-queries";
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

const COLUMNS: IssueColumnOption[] = [{ id: "col-1", name: "In progress" }];

const ASSIGNEE_POOL: AssigneeOption[] = [
  { id: "user-2", firstName: "Alan", lastName: "Turing", avatarUrl: null, jobTitle: null },
];

function renderDetail(issue: IssueView) {
  return render(
    <IssueDetail
      issue={issue}
      columns={COLUMNS}
      assigneePool={ASSIGNEE_POOL}
    />,
  );
}

describe("IssueDetail — layout (FR-042, FR-043, FR-045, US2 s1)", () => {
  it("renders a main column and a 262px meta rail", () => {
    renderDetail(makeIssueView());

    const rail = screen.getByRole("complementary", { name: "Issue details" });
    expect(rail.className).toContain("262px");
  });

  it("puts the key first in document order, then the title, then the description", () => {
    renderDetail(makeIssueView());

    const key = screen.getByText("WEB-142");
    const title = screen.getByText("Fix the header");
    const description = screen.getByText("Some description");

    expect(key.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(title.compareDocumentPosition(description) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows column, priority, assignee and due date in the rail", () => {
    renderDetail(makeIssueView());

    expect(screen.getByLabelText("Column").textContent).toContain("In progress");
    expect(screen.getByLabelText("Priority").textContent).toContain("High");
    expect(screen.getByLabelText("Assignee").textContent).toContain("Alan Turing");
    expect((screen.getByLabelText("Due date") as HTMLInputElement).value).toBe("2026-02-01");
  });

  it("shows project and created-by as values rather than controls", () => {
    renderDetail(makeIssueView());

    expect(screen.getByText("Website Redesign")).toBeDefined();
    expect(screen.getByText("Grace Hopper")).toBeDefined();
    expect(screen.getByText("Website Redesign").closest("button, select, input, textarea")).toBeNull();
    expect(screen.getByText("Grace Hopper").closest("button, select, input, textarea")).toBeNull();
  });

  it("renders no Activity section and no label control anywhere", () => {
    renderDetail(makeIssueView());

    expect(screen.queryByText(/^activity$/i)).toBeNull();
    expect(screen.queryByText(/^labels?$/i)).toBeNull();
  });
});