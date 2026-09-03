import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UpdateIssuePayload, UpdateIssueResult } from "../actions";
import { IssueRail } from "./issue-rail";

const showToastMock = vi.fn();
vi.mock("@/features/shell/components/toast-region", () => ({
  showToast: (...args: unknown[]) => showToastMock(...args),
}));

const COLUMNS = [
  { id: "col-open", name: "In progress" },
  { id: "col-done", name: "Done" },
];

const ASSIGNEE_POOL = [
  { id: "user-2", firstName: "Alan", lastName: "Turing", avatarUrl: null, jobTitle: null },
];

beforeEach(() => {
  showToastMock.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderRail(updateIssueAction: (input: UpdateIssuePayload) => Promise<UpdateIssueResult>) {
  return render(
    <IssueRail
      issueId="issue-1"
      column={{ id: "col-open", name: "In progress" }}
      priority="none"
      assignee={null}
      dueDate={null}
      columns={COLUMNS}
      assigneePool={ASSIGNEE_POOL}
      updateIssueAction={updateIssueAction}
    />,
  );
}

describe("IssueRail — optimistic apply and rollback (FR-050, SC-006, US3 s4)", () => {
  it("shows the new assignee before the server answers", async () => {
    let resolveUpdate: (value: UpdateIssueResult) => void = () => undefined;
    const updateIssueAction = vi.fn<(input: UpdateIssuePayload) => Promise<UpdateIssueResult>>(
      () =>
        new Promise<UpdateIssueResult>((resolve) => {
          resolveUpdate = resolve;
        }),
    );
    renderRail(updateIssueAction);

    fireEvent.click(screen.getByLabelText("Assignee"));
    fireEvent.click(screen.getByRole("option", { name: "Alan Turing" }));

    await waitFor(() => expect(screen.getByLabelText("Assignee").textContent).toContain("Alan Turing"));

    resolveUpdate({ status: "ok" });
  });

  it("rolls back to the previous assignee, and shows a toast naming what failed, on refusal", async () => {
    const updateIssueAction = vi
      .fn<(input: UpdateIssuePayload) => Promise<UpdateIssueResult>>()
      .mockResolvedValue({
        status: "invalid",
        field: "assigneeId",
        reason: "not-a-member-of-this-project",
      });
    renderRail(updateIssueAction);

    fireEvent.click(screen.getByLabelText("Assignee"));
    fireEvent.click(screen.getByRole("option", { name: "Alan Turing" }));

    await waitFor(() => expect(screen.getByLabelText("Assignee").textContent).toContain("Unassigned"));
    expect(showToastMock).toHaveBeenCalledTimes(1);
    expect(showToastMock).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "error", message: expect.any(String) }),
    );
  });

  it("raises no toast at all on a successful write", async () => {
    const updateIssueAction = vi
      .fn<(input: UpdateIssuePayload) => Promise<UpdateIssueResult>>()
      .mockResolvedValue({ status: "ok" });
    renderRail(updateIssueAction);

    fireEvent.click(screen.getByLabelText("Assignee"));
    fireEvent.click(screen.getByRole("option", { name: "Alan Turing" }));

    await waitFor(() => expect(updateIssueAction).toHaveBeenCalledTimes(1));
    expect(showToastMock).not.toHaveBeenCalled();
  });
});