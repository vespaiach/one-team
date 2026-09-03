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
    assignee: null,
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
const ASSIGNEE_POOL: AssigneeOption[] = [];
const REASON = "Only project members can edit issues in Website Redesign.";
const LABELS = ["Title", "Description", "Column", "Priority", "Assignee", "Due date"];

function renderDisabled() {
  return render(
    <IssueDetail
      issue={makeIssueView()}
      columns={COLUMNS}
      assigneePool={ASSIGNEE_POOL}
      canWrite={false}
      writeReason={REASON}
    />,
  );
}

function describedReasonText(element: Element): string | null {
  const describedBy = element.getAttribute("aria-describedby");
  if (!describedBy) {
    return null;
  }
  const described = describedBy
    .split(" ")
    .map((id) => document.getElementById(id))
    .filter((node): node is HTMLElement => node !== null)
    .map((node) => node.textContent)
    .join(" ");
  return described || null;
}

describe("IssueDetail — a11y: the disabled reason is the control's own description (FR-068, SC-022, research D-11)", () => {
  it.each(LABELS)("associates %s's disabled reason with that control via aria-describedby", (label) => {
    renderDisabled();

    const control = screen.getByLabelText(label);
    expect(describedReasonText(control)).toBe(REASON);
  });

  it("does not rely on adjacent, unassociated text as the only carrier of the reason", () => {
    renderDisabled();

    const title = screen.getByLabelText("Title");
    expect(title.hasAttribute("aria-describedby")).toBe(true);
  });
});

describe("IssueDetail — a11y: every control carries an accessible name (FR-068)", () => {
  it.each(LABELS)("gives %s an accessible name reachable by label text", (label) => {
    renderDisabled();

    expect(screen.getByLabelText(label)).toBeDefined();
  });
});

describe("IssueDetail — a11y: column and priority carry a text equivalent beside colour (FR-068)", () => {
  it("renders the priority's value as visible text, not colour alone", () => {
    renderDisabled();

    expect(screen.getByLabelText("Priority").textContent).toContain("High");
  });

  it("renders the column's value as visible text, not colour alone", () => {
    renderDisabled();

    expect(screen.getByLabelText("Column").textContent).toContain("In progress");
  });
});