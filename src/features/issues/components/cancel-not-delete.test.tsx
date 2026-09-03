import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { UpdateIssuePayload, UpdateIssueResult } from "../actions";
import { IssueRail } from "./issue-rail";

afterEach(() => {
  vi.restoreAllMocks();
});

const COLUMNS = [
  { id: "col-open", name: "In progress" },
  { id: "col-canceled", name: "Canceled" },
];

const ASSIGNEE_POOL = [
  { id: "user-2", firstName: "Alan", lastName: "Turing", avatarUrl: null, jobTitle: null },
];

function renderRail(
  updateIssueAction: (input: UpdateIssuePayload) => Promise<UpdateIssueResult>,
  column: { id: string; name: string } = { id: "col-open", name: "In progress" },
) {
  return render(
    <IssueRail
      issueId="issue-1"
      column={column}
      priority="none"
      assignee={null}
      dueDate={null}
      columns={COLUMNS}
      assigneePool={ASSIGNEE_POOL}
      updateIssueAction={updateIssueAction}
    />,
  );
}

describe("A member's cancellation route needs no mutator of its own (FR-053, FR-056, US5 s3)", () => {
  it("offers the project's canceled-kind column through the ordinary column control", async () => {
    const updateIssueAction = vi
      .fn<(input: UpdateIssuePayload) => Promise<UpdateIssueResult>>()
      .mockResolvedValue({ status: "ok" });
    renderRail(updateIssueAction);

    fireEvent.click(screen.getByLabelText("Column"));
    fireEvent.click(screen.getByRole("option", { name: "Canceled" }));

    expect(updateIssueAction).toHaveBeenCalledWith({ issueId: "issue-1", columnId: "col-canceled" });
  });

  it("lets the move back out of the canceled-kind column, since it is reversible", async () => {
    const updateIssueAction = vi
      .fn<(input: UpdateIssuePayload) => Promise<UpdateIssueResult>>()
      .mockResolvedValue({ status: "ok" });
    renderRail(updateIssueAction, { id: "col-canceled", name: "Canceled" });

    fireEvent.click(screen.getByLabelText("Column"));
    fireEvent.click(screen.getByRole("option", { name: "In progress" }));

    expect(updateIssueAction).toHaveBeenCalledWith({ issueId: "issue-1", columnId: "col-open" });
  });
});