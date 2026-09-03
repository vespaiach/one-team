import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DeleteIssuePayload, DeleteIssueResult } from "../actions";
import { DeleteIssueControl } from "./delete-issue-control";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

function renderControl(deleteIssueAction: (input: DeleteIssuePayload) => Promise<DeleteIssueResult>) {
  return render(
    <DeleteIssueControl
      issueId="issue-1"
      issueKey="WEB-142"
      issueTitle="Fix the sign-in redirect"
      projectKey="WEB"
      canDelete={true}
      deleteReason=""
      deleteIssueAction={deleteIssueAction}
    />,
  );
}

describe("Delete confirmation — names the issue by key and title, no count today (FR-062, edge case: cascade reaches nothing)", () => {
  it("names the issue by its key and title", async () => {
    renderControl(vi.fn());

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByText(/WEB-142/)).not.toBeNull();
    expect(screen.getByText(/Fix the sign-in redirect/)).not.toBeNull();
  });

  it("confirms without a count, in the same register as any other confirmation", async () => {
    renderControl(vi.fn());

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await screen.findByRole("alertdialog");

    const sentence = screen.getByText(/can't be undone/i);
    expect(sentence.textContent).not.toMatch(/\d/);
  });
});

describe("Delete confirmation — focus and dismissal (FR-061)", () => {
  it("takes and holds focus when it opens", async () => {
    renderControl(vi.fn());

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("alertdialog");

    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  });

  it("does not open with the destructive action focused", async () => {
    renderControl(vi.fn());

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await screen.findByRole("alertdialog");

    const confirmButton = screen.getByRole("button", { name: "Confirm delete" });
    expect(document.activeElement).not.toBe(confirmButton);
  });

  it("dismisses on Escape without calling the delete action, and returns focus to the Delete control", async () => {
    const deleteIssueAction = vi.fn<(input: DeleteIssuePayload) => Promise<DeleteIssueResult>>();
    renderControl(deleteIssueAction);
    const trigger = screen.getByRole("button", { name: "Delete" });

    trigger.focus();
    fireEvent.click(trigger);
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.keyDown(dialog, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(deleteIssueAction).not.toHaveBeenCalled();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("dismisses on an explicit cancel without calling the delete action, and returns focus to the Delete control", async () => {
    const deleteIssueAction = vi.fn<(input: DeleteIssuePayload) => Promise<DeleteIssueResult>>();
    renderControl(deleteIssueAction);
    const trigger = screen.getByRole("button", { name: "Delete" });

    trigger.focus();
    fireEvent.click(trigger);
    await screen.findByRole("alertdialog");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(deleteIssueAction).not.toHaveBeenCalled();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});