import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CommentRow } from "./comment-row";

vi.mock("../actions", () => ({
  updateComment: vi.fn(),
  deleteComment: vi.fn(),
  resolveCommentMentions: vi
    .fn()
    .mockResolvedValue({ "0198f2a4-1234-7abc-8def-0123456789ab": "Grace Hopper" }),
}));

const ACTOR = {
  firstName: "Ada",
  lastName: "Lovelace",
  avatarUrl: "https://example.com/ada.png",
};

function renderRow(overrides: Partial<Parameters<typeof CommentRow>[0]> = {}) {
  return render(
    <CommentRow
      id="comment-1"
      actor={ACTOR}
      body="Looks good to me."
      createdAt={new Date(Date.now() - 2 * 60 * 60 * 1000)}
      canEdit={false}
      canDelete={false}
      {...overrides}
    />,
  );
}

describe("CommentRow (FR-028, FR-029, US1 s1, s8)", () => {
  it("shows the author's avatar, display name and body", () => {
    renderRow();

    expect(screen.getByRole("img", { name: "Ada Lovelace" }).getAttribute("src")).toBe(
      "https://example.com/ada.png",
    );
    expect(screen.getByText("Ada Lovelace")).not.toBeNull();
    expect(screen.getByText("Looks good to me.")).not.toBeNull();
  });

  it("shows a relative time", () => {
    renderRow();

    expect(screen.getByText(/ago/)).not.toBeNull();
  });

  it("carries an id attribute of the literal form comment-<id> unconditionally", () => {
    const { container } = renderRow({ id: "abc-123" });

    expect(container.querySelector("#comment-abc-123")).not.toBeNull();
  });

  it("carries neither an edit nor a delete control", () => {
    renderRow();

    expect(screen.queryByRole("button", { name: /edit/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /delete/i })).toBeNull();
  });
});

describe("CommentRow — mention resolution (FR-022, FR-023)", () => {
  it("renders a mention token as the mentioned user's current display name, never the raw bracket syntax", async () => {
    renderRow({ body: "Hey @[0198f2a4-1234-7abc-8def-0123456789ab], can you take a look?" });

    await waitFor(() => expect(screen.getByText(/Grace Hopper/)).not.toBeNull());
    expect(screen.queryByText(/@\[0198f2a4-1234-7abc-8def-0123456789ab\]/)).toBeNull();
  });
});