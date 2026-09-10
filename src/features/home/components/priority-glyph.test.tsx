import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PriorityGlyph } from "./priority-glyph";

describe("PriorityGlyph", () => {
  it("renders urgent as a labeled exclamation mark", () => {
    render(<PriorityGlyph priority="urgent" />);
    expect(screen.getByLabelText("Urgent")).toBeTruthy();
  });

  it("renders the other priorities as decorative bars with no accessible name", () => {
    render(<PriorityGlyph priority="high" />);
    expect(screen.queryByLabelText("Urgent")).toBeNull();
  });
});