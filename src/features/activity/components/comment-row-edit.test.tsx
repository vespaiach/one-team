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
      canEdit={true}
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

describe("CommentRow — the in-place edit gesture (FR-043, US3 s1, s2)", () => {
  it("turns the body into a focused field when activated", async () => {
    renderRow();

    fireEvent.click(screen.getByRole("button", { name: /edit/i }));

    const field = await screen.findByRole("textbox", { name: /edit comment/i });
    expect((field as HTMLTextAreaElement).value).toBe("Looks good to me.");
    expect(document.activeElement).toBe(field);
  });

  it("reverts to the saved text and writes nothing on Escape", async () => {
    renderRow();

    fireEvent.click(screen.getByRole("button", { name: /edit/i }));
    const field = await screen.findByRole("textbox", { name: /edit comment/i });
    fireEvent.change(field, { target: { value: "Something else entirely." } });
    fireEvent.keyDown(field, { key: "Escape" });

    expect(screen.queryByRole("textbox", { name: /edit comment/i })).toBeNull();
    expect(screen.getByText("Looks good to me.")).not.toBeNull();
    expect(updateCommentMock).not.toHaveBeenCalled();
  });

  it("renders the new text immediately and saves with exactly one updateComment call on cmd-enter", async () => {
    let resolveUpdate: (value: UpdateCommentResult) => void = () => undefined;
    updateCommentMock.mockImplementation(
      () =>
        new Promise<UpdateCommentResult>((resolve) => {
          resolveUpdate = resolve;
        }),
    );
    renderRow();

    fireEvent.click(screen.getByRole("button", { name: /edit/i }));
    const field = await screen.findByRole("textbox", { name: /edit comment/i });
    fireEvent.change(field, { target: { value: "Revised text." } });
    fireEvent.keyDown(field, { key: "Enter", metaKey: true });

    await waitFor(() => expect(screen.getByText("Revised text.")).not.toBeNull());
    expect(updateCommentMock).toHaveBeenCalledTimes(1);
    expect(updateCommentMock).toHaveBeenCalledWith({ commentId: "comment-1", body: "Revised text." });

    resolveUpdate({ status: "ok" });
  });

  it("refuses a whitespace-only save inline, keeping the previous text and calling updateComment never", async () => {
    renderRow();

    fireEvent.click(screen.getByRole("button", { name: /edit/i }));
    const field = await screen.findByRole("textbox", { name: /edit comment/i });
    fireEvent.change(field, { target: { value: "   \n\t  " } });
    fireEvent.keyDown(field, { key: "Enter", metaKey: true });

    expect(screen.getByText(/can't be empty/i)).not.toBeNull();
    expect(updateCommentMock).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: /edit comment/i })).not.toBeNull();
  });
});