import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DeleteLabelResult } from "../server/delete-label";
import { DeleteLabelDialog } from "./delete-label-dialog";

const showToastMock = vi.fn();
vi.mock("@/features/shell/components/toast-region", () => ({
  showToast: (...args: unknown[]) => showToastMock(...args),
}));

afterEach(() => {
  vi.restoreAllMocks();
  showToastMock.mockClear();
});

function renderDialog(
  props: Partial<Parameters<typeof DeleteLabelDialog>[0]> & {
    deleteLabelAction?: (id: string) => Promise<DeleteLabelResult>;
  } = {},
) {
  const deleteLabelAction = props.deleteLabelAction ?? vi.fn<(id: string) => Promise<DeleteLabelResult>>();
  return render(
    <DeleteLabelDialog
      labelId="l1"
      labelName="Bug"
      issueCount={0}
      deleteLabelAction={deleteLabelAction}
      {...props}
    />,
  );
}

describe("DeleteLabelDialog — the sentence (FR-011)", () => {
  it("reads exactly the count sentence when issueCount > 0", async () => {
    renderDialog({ issueCount: 14 });

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(
      await screen.findByText("It will be removed from 14 issues. This can't be undone."),
    ).not.toBeNull();
  });

  it("reads the same confirmation without the count clause when issueCount is 0", async () => {
    renderDialog({ issueCount: 0 });

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByText("This can't be undone.")).not.toBeNull();
    expect(screen.queryByText(/removed from/i)).toBeNull();
  });

  it("names the label in the heading", async () => {
    renderDialog({ labelName: "Bug", issueCount: 0 });

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByText(/Bug/)).not.toBeNull();
  });
});

describe("DeleteLabelDialog — confirm and dismiss (FR-011)", () => {
  it("calls deleteLabel with the label id and closes on success", async () => {
    const deleteLabelAction = vi.fn<(id: string) => Promise<DeleteLabelResult>>().mockResolvedValue({
      ok: true,
      removedFromIssueCount: 0,
    });
    renderDialog({ labelId: "l1", deleteLabelAction });

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await screen.findByRole("alertdialog");
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));

    await waitFor(() => expect(deleteLabelAction).toHaveBeenCalledWith("l1"));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });

  it("discards on Cancel without calling deleteLabel", async () => {
    const deleteLabelAction = vi.fn<(id: string) => Promise<DeleteLabelResult>>();
    renderDialog({ deleteLabelAction });

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await screen.findByRole("alertdialog");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(deleteLabelAction).not.toHaveBeenCalled();
  });

  it("discards on Escape without calling deleteLabel", async () => {
    const deleteLabelAction = vi.fn<(id: string) => Promise<DeleteLabelResult>>();
    renderDialog({ deleteLabelAction });

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.keyDown(dialog, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(deleteLabelAction).not.toHaveBeenCalled();
  });
});

describe("DeleteLabelDialog — focus returns to the row's Delete control", () => {
  it("returns focus to the Delete trigger on Escape", async () => {
    const deleteLabelAction = vi.fn<(id: string) => Promise<DeleteLabelResult>>();
    renderDialog({ deleteLabelAction });
    const trigger = screen.getByRole("button", { name: "Delete" });

    trigger.focus();
    fireEvent.click(trigger);
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.keyDown(dialog, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("returns focus to the Delete trigger on Cancel", async () => {
    const deleteLabelAction = vi.fn<(id: string) => Promise<DeleteLabelResult>>();
    renderDialog({ deleteLabelAction });
    const trigger = screen.getByRole("button", { name: "Delete" });

    trigger.focus();
    fireEvent.click(trigger);
    await screen.findByRole("alertdialog");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});

describe("DeleteLabelDialog — a refusal rolls back with a toast (§4)", () => {
  it("shows an error toast and keeps the label when the server refuses", async () => {
    const deleteLabelAction = vi.fn<(id: string) => Promise<DeleteLabelResult>>().mockResolvedValue({
      ok: false,
      error: "not_found",
    });
    renderDialog({ deleteLabelAction });

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await screen.findByRole("alertdialog");
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));

    await waitFor(() => expect(showToastMock).toHaveBeenCalled());
  });
});