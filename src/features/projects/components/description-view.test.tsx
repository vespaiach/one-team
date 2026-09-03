import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DescriptionView } from "./description-view";

describe("DescriptionView (FR-039)", () => {
  it("renders markdown on read", () => {
    render(
      <DescriptionView
        description="**bold** text"
        onSave={vi.fn()}
      />,
    );

    const button = screen.getByRole("button", { name: "Description" });
    expect(button.querySelector("strong")?.textContent).toBe("bold");
  });

  it("shows the raw source in the field while editing", async () => {
    render(
      <DescriptionView
        description="**bold** text"
        onSave={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Description" }));
    const textarea = await screen.findByRole("textbox", { name: "Description" });
    expect((textarea as HTMLTextAreaElement).value).toBe("**bold** text");
    expect(textarea.querySelector("strong")).toBeNull();
  });

  it("renders a placeholder that opens the editor when the description is empty", async () => {
    render(
      <DescriptionView
        description={null}
        onSave={vi.fn()}
      />,
    );

    const button = screen.getByRole("button", { name: "Description" });
    expect(button.textContent).toBe("Add a description");

    fireEvent.click(button);

    expect(await screen.findByRole("textbox", { name: "Description" })).not.toBeNull();
  });
});