import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DeleteIssuePayload, DeleteIssueResult } from "../actions";
import { DeleteIssueControl } from "./delete-issue-control";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const showToastMock = vi.fn();
vi.mock("@/features/shell/components/toast-region", () => ({
  showToast: (...args: unknown[]) => showToastMock(...args),
}));

beforeEach(() => {
  pushMock.mockClear();
  showToastMock.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderControl(deleteIssueAction: (input: DeleteIssuePayload) => Promise<DeleteIssueResult>) {
  return render(
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
}

describe("Delete navigation — lands on the project's details page (FR-060, US5 s1)", () => {
  it("navigates to /projects/:projectKey/details on a successful delete", async () => {
    const deleteIssueAction = vi
      .fn<(input: DeleteIssuePayload) => Promise<DeleteIssueResult>>()
      .mockResolvedValue({
        status: "ok",
      });
    renderControl(deleteIssueAction);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await screen.findByRole("alertdialog");
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/projects/WEB/details"));
  });

  it("calls the delete action with the issue's id", async () => {
    const deleteIssueAction = vi
      .fn<(input: DeleteIssuePayload) => Promise<DeleteIssueResult>>()
      .mockResolvedValue({
        status: "ok",
      });
    renderControl(deleteIssueAction);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await screen.findByRole("alertdialog");
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));

    await waitFor(() => expect(deleteIssueAction).toHaveBeenCalledTimes(1));
    expect(deleteIssueAction.mock.calls[0]?.[0]).toMatchObject({ issueId: "issue-1" });
  });

  it("shows a message and does not navigate when the server refuses", async () => {
    const deleteIssueAction = vi
      .fn<(input: DeleteIssuePayload) => Promise<DeleteIssueResult>>()
      .mockResolvedValue({
        status: "forbidden",
        reason: "Only admins can delete issues in Website Redesign.",
      });
    renderControl(deleteIssueAction);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await screen.findByRole("alertdialog");
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));

    await waitFor(() => expect(showToastMock).toHaveBeenCalled());
    expect(pushMock).not.toHaveBeenCalled();
  });
});