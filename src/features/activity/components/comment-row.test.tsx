import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CommentRow } from "./comment-row";

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