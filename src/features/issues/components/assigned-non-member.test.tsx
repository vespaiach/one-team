import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { AssigneeOption, IssueColumnOption, IssueView, PublicUser } from "../server/issue-queries";
import { IssueDetail } from "./issue-detail";

const VIEWER: PublicUser = {
  id: "user-2",
  firstName: "Alan",
  lastName: "Turing",
  avatarUrl: null,
  role: "member",
  jobTitle: null,
  deactivatedAt: null,
};

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
    assignee: VIEWER,
    dueDate: null,
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
  { id: VIEWER.id, firstName: VIEWER.firstName, lastName: VIEWER.lastName, avatarUrl: null, jobTitle: null },
];
const REASON = "Only project members can edit issues in Website Redesign.";

describe("IssueDetail — a non-member assigned to their own issue (FR-023, SC-008, US4 s2)", () => {
  it("shows their own assignment alongside a reason naming the project, with no control operated", () => {
    render(
      <IssueDetail
        issue={makeIssueView()}
        columns={COLUMNS}
        assigneePool={ASSIGNEE_POOL}
        canWrite={false}
        writeReason={REASON}
      />,
    );

    expect(screen.getByLabelText("Assignee").textContent).toContain("Alan Turing");
    expect(screen.getAllByText(REASON).length).toBeGreaterThan(0);
  });

  it("names the project they would need to be added to, in the project's own name", () => {
    render(
      <IssueDetail
        issue={makeIssueView({ project: { key: "WEB", name: "Website Redesign" } })}
        columns={COLUMNS}
        assigneePool={ASSIGNEE_POOL}
        canWrite={false}
        writeReason={REASON}
      />,
    );

    expect(screen.getAllByText(/Website Redesign/).length).toBeGreaterThan(0);
  });

  it("reads on first render, without expanding or focusing the assignee control", () => {
    render(
      <IssueDetail
        issue={makeIssueView()}
        columns={COLUMNS}
        assigneePool={ASSIGNEE_POOL}
        canWrite={false}
        writeReason={REASON}
      />,
    );

    expect(screen.queryByRole("option")).toBeNull();
    expect(screen.getAllByText(REASON).length).toBeGreaterThan(0);
  });
});