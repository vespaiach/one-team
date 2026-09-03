import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DeleteIssuePayload, DeleteIssueResult } from "../actions";
import type { AssigneeOption, IssueColumnOption, IssueView } from "../server/issue-queries";
import { DeleteIssueControl } from "./delete-issue-control";
import { IssueDetail } from "./issue-detail";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

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

describe("DeleteIssueControl — placement, beneath the rail's four rows (FR-061, US5 s2)", () => {
  it("sits in document order after Column, Priority, Assignee and Due date", () => {
    render(
      <IssueDetail
        issue={makeIssueView()}
        columns={COLUMNS}
        assigneePool={ASSIGNEE_POOL}
        canWrite={true}
        writeReason=""
        canDelete={true}
        deleteReason=""
      />,
    );

    const dueDate = screen.getByLabelText("Due date");
    const deleteButton = screen.getByRole("button", { name: "Delete" });

    expect(dueDate.compareDocumentPosition(deleteButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe("DeleteIssueControl — enablement (FR-061, SC-010, US5 s2, s4)", () => {
  it("is enabled for an admin", () => {
    render(
      <DeleteIssueControl
        issueId="issue-1"
        issueKey="WEB-142"
        issueTitle="Fix the header"
        projectKey="WEB"
        canDelete={true}
        deleteReason=""
        deleteIssueAction={vi.fn()}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Delete" });
    expect(trigger.hasAttribute("disabled")).toBe(false);
  });

  it("is visible and disabled with its inline reason for a non-admin, never hidden", () => {
    render(
      <DeleteIssueControl
        issueId="issue-1"
        issueKey="WEB-142"
        issueTitle="Fix the header"
        projectKey="WEB"
        canDelete={false}
        deleteReason="Only admins can delete issues in Website Redesign."
        deleteIssueAction={vi.fn()}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Delete" });
    expect(trigger.hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("Only admins can delete issues in Website Redesign.")).not.toBeNull();
  });
});

describe("DeleteIssueControl — no path writes without the confirmation (FR-061)", () => {
  it("does not call the delete action merely by opening the confirmation", async () => {
    const deleteIssueAction = vi.fn<(input: DeleteIssuePayload) => Promise<DeleteIssueResult>>();
    render(
      <DeleteIssueControl
        issueId="issue-1"
        issueKey="WEB-142"
        issueTitle="Fix the header"
        projectKey="WEB"
        canDelete={true}
        deleteReason=""
        deleteIssueAction={deleteIssueAction}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await screen.findByRole("alertdialog");

    expect(deleteIssueAction).not.toHaveBeenCalled();
  });
});