import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DeleteCommentResult, UpdateCommentResult } from "../actions";
import { CommentRow } from "./comment-row";

const updateCommentMock =
  vi.fn<(input: { commentId: string; body: unknown }) => Promise<UpdateCommentResult>>();
const deleteCommentMock = vi.fn<(input: { commentId: string }) => Promise<DeleteCommentResult>>();

vi.mock("../actions", () => ({
  updateComment: (input: { commentId: string; body: unknown }) => updateCommentMock(input),
  deleteComment: (input: { commentId: string }) => deleteCommentMock(input),
}));

const ACTOR = { firstName: "Ada", lastName: "Lovelace", avatarUrl: null };

function renderRow(overrides: Partial<Parameters<typeof CommentRow>[0]> = {}) {
  return render(
    <CommentRow
      id="comment-1"
      actor={ACTOR}
      body="Looks good to me."
      createdAt={new Date()}
      canEdit={false}
      canDelete={false}
      {...overrides}
    />,
  );
}

beforeEach(() => {
  updateCommentMock.mockReset();
  deleteCommentMock.mockReset();
  updateCommentMock.mockResolvedValue({ status: "ok" });
  deleteCommentMock.mockResolvedValue({ status: "ok" });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CommentRow — control visibility (FR-028)", () => {
  it("renders an edit control only when canEdit is true", () => {
    const { rerender } = renderRow({ canEdit: false });
    expect(screen.queryByRole("button", { name: /edit/i })).toBeNull();

    rerender(
      <CommentRow
        id="comment-1"
        actor={ACTOR}
        body="Looks good to me."
        createdAt={new Date()}
        canEdit={true}
        canDelete={false}
      />,
    );
    expect(screen.getByRole("button", { name: /edit/i })).not.toBeNull();
  });

  it("renders a delete control only when canDelete is true", () => {
    const { rerender } = renderRow({ canDelete: false });
    expect(screen.queryByRole("button", { name: /delete/i })).toBeNull();

    rerender(
      <CommentRow
        id="comment-1"
        actor={ACTOR}
        body="Looks good to me."
        createdAt={new Date()}
        canEdit={false}
        canDelete={true}
      />,
    );
    expect(screen.getByRole("button", { name: /delete/i })).not.toBeNull();
  });
});

describe("CommentRow — delete's inline Confirm/Cancel swap (FR-044, US3 s3, s7)", () => {
  it("swaps the delete control in place for a Confirm/Cancel pair rather than deleting immediately", () => {
    renderRow({ canDelete: true });

    fireEvent.click(screen.getByRole("button", { name: "Delete comment" }));

    expect(screen.queryByRole("button", { name: "Delete comment" })).toBeNull();
    expect(screen.getByRole("button", { name: /confirm/i })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Cancel" })).not.toBeNull();
    expect(deleteCommentMock).not.toHaveBeenCalled();
  });

  it("moves keyboard focus onto Confirm delete so it is never lost when Delete unmounts (FR-061)", () => {
    renderRow({ canDelete: true });

    fireEvent.click(screen.getByRole("button", { name: "Delete comment" }));

    expect(document.activeElement).toBe(screen.getByRole("button", { name: /confirm/i }));
  });

  it("reverts to the original control on Cancel, deleting nothing", () => {
    renderRow({ canDelete: true });

    fireEvent.click(screen.getByRole("button", { name: "Delete comment" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("button", { name: "Delete comment" })).not.toBeNull();
    expect(deleteCommentMock).not.toHaveBeenCalled();
  });

  it("reverts to the original control when focus moves away, deleting nothing", () => {
    renderRow({ canDelete: true });

    fireEvent.click(screen.getByRole("button", { name: "Delete comment" }));
    const confirmButton = screen.getByRole("button", { name: /confirm/i });
    fireEvent.blur(confirmButton, { relatedTarget: document.body });

    expect(screen.getByRole("button", { name: "Delete comment" })).not.toBeNull();
    expect(deleteCommentMock).not.toHaveBeenCalled();
  });

  it("does not revert when focus moves between Confirm and Cancel, staying within the group", () => {
    renderRow({ canDelete: true });

    fireEvent.click(screen.getByRole("button", { name: "Delete comment" }));
    const confirmButton = screen.getByRole("button", { name: /confirm/i });
    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    fireEvent.blur(confirmButton, { relatedTarget: cancelButton });

    expect(screen.getByRole("button", { name: /confirm/i })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Cancel" })).not.toBeNull();
  });

  it("calls deleteComment exactly once, only on Confirm", async () => {
    renderRow({ canDelete: true });

    fireEvent.click(screen.getByRole("button", { name: "Delete comment" }));
    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));

    await waitFor(() => expect(deleteCommentMock).toHaveBeenCalledTimes(1));
    expect(deleteCommentMock).toHaveBeenCalledWith({ commentId: "comment-1" });
  });
});