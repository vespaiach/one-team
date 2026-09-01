import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CardFooterNote } from "./card-footer-note";

describe("CardFooterNote", () => {
  it("renders its content with the footer's divider-top styling", () => {
    render(<CardFooterNote>A reset link still works while an address is locked.</CardFooterNote>);

    const note = screen.getByText("A reset link still works while an address is locked.");
    expect(note.className).toContain("border-t");
    expect(note.className).toContain("border-[var(--color-divider)]");
  });
});