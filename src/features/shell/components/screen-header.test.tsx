import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScreenHeader } from "./screen-header";

describe("ScreenHeader (FR-007, FR-008, FR-017)", () => {
  it("renders a title block with a name and a context line", () => {
    render(
      <ScreenHeader
        name="Accounts"
        context="4 people"
      />,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Accounts" })).not.toBeNull();
    expect(screen.getByText("4 people")).not.toBeNull();
  });

  it("omits the context line entirely rather than rendering it empty when absent (edge case)", () => {
    const { container } = render(<ScreenHeader name="Accounts" />);

    expect(container.querySelectorAll("p")).toHaveLength(0);
  });

  it("renders exactly one control slot and one New issue slot, both empty when a screen has none (s4, s6)", () => {
    render(<ScreenHeader name="Accounts" />);

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("link", { name: /new issue/i })).toBeNull();
  });

  it("renders the New issue slot's content only when supplied, for a project-scoped screen (s5)", () => {
    render(
      <ScreenHeader
        name="Board"
        newIssue={<button type="button">New issue</button>}
      />,
    );

    expect(screen.getByRole("button", { name: "New issue" })).not.toBeNull();
  });

  it("renders the control slot's content only when supplied", () => {
    render(
      <ScreenHeader
        name="Board"
        control={<button type="button">Group by</button>}
      />,
    );

    expect(screen.getByRole("button", { name: "Group by" })).not.toBeNull();
  });

  it("renders no fixed height on the header, so a context line makes it taller by content alone", () => {
    const { container: withoutContext } = render(<ScreenHeader name="Board" />);
    const { container: withContext } = render(
      <ScreenHeader
        name="Board"
        context="Some context"
      />,
    );

    expect(withoutContext.querySelector("header")?.className).not.toMatch(/\bh-\[/);
    expect(withContext.querySelector("header")?.className).not.toMatch(/\bh-\[/);
  });

  it("truncates a name too long for its width on one line rather than wrapping or widening", () => {
    render(<ScreenHeader name="A very very very very very very very long project name" />);

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.className).toContain("truncate");
  });
});