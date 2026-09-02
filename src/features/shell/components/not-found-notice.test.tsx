import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NotFoundNotice } from "./not-found-notice";

describe("NotFoundNotice (FR-022, SC-008, research *Assumptions carried forward* 2)", () => {
  it("renders the exact wording, capitalisation and apostrophe included, no full stop (s5, s6)", () => {
    render(<NotFoundNotice />);

    expect(screen.getByText("This doesn't exist")).not.toBeNull();
  });

  it("says nothing about access anywhere in the output", () => {
    const { container } = render(<NotFoundNotice />);

    expect(container.textContent?.toLowerCase()).not.toContain("access");
  });

  it("renders no heading — a path that matched nothing is not a screen and has no name for a title block", () => {
    render(<NotFoundNotice />);

    expect(screen.queryByRole("heading")).toBeNull();
  });
});