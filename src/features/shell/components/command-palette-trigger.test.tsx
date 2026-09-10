import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CommandPaletteTrigger } from "./command-palette-trigger";

describe("CommandPaletteTrigger", () => {
  it("is closed until pressed, and shows the ⌘K hint on its trigger", () => {
    render(<CommandPaletteTrigger />);

    expect(screen.queryByRole("dialog")).toBeNull();
    const trigger = screen.getByRole("button", { name: /search/i });
    expect(trigger.textContent).toContain("⌘");
    expect(trigger.textContent).toContain("K");
  });

  it("opens a search-styled dialog with no working search or actions", () => {
    render(<CommandPaletteTrigger />);

    fireEvent.click(screen.getByRole("button", { name: /search/i }));

    const dialog = screen.getByRole("dialog");
    expect(dialog.querySelector("input")).not.toBeNull();
    expect(dialog.querySelectorAll("button, a").length).toBe(0);
  });
});