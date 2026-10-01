import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./EmptyState.tsx";

const focusable = "a[href], button, input, select, textarea, summary, iframe, [tabindex], [contenteditable]";

describe("EmptyState", () => {
  it("shows the message as plain text with no link or button", () => {
    const { container } = render(<EmptyState message="No issues yet. Create one." />);
    const message = screen.getByText("No issues yet. Create one.");
    expect(message.closest("a, button")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(container.querySelectorAll(focusable)).toHaveLength(0);
  });
});