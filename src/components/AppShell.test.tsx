import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppShell } from "./AppShell.tsx";

const focusable =
  "a[href], button, input, select, textarea, summary, iframe, [tabindex], [contenteditable]";

describe("AppShell", () => {
  it("shows the product name as plain text in the navigation region", () => {
    render(<AppShell>content</AppShell>);
    const navigation = screen.getByRole("navigation");
    const name = within(navigation).getByText("Tracklite");
    expect(name.closest("a")).toBeNull();
    expect(within(navigation).queryByRole("link")).toBeNull();
  });

  it("has no project list element", () => {
    render(<AppShell>content</AppShell>);
    const navigation = screen.getByRole("navigation");
    expect(navigation.querySelector("ul, ol, [role='list']")).toBeNull();
    expect(within(navigation).queryByRole("list")).toBeNull();
  });

  it("has nothing focusable in the sidebar", () => {
    render(<AppShell>content</AppShell>);
    const navigation = screen.getByRole("navigation");
    expect(navigation.querySelectorAll(focusable)).toHaveLength(0);
  });

  it("renders its children in the main region", () => {
    render(
      <AppShell>
        <p>Page content</p>
      </AppShell>,
    );
    const main = screen.getByRole("main");
    expect(within(main).getByText("Page content")).toBeTruthy();
    expect(within(screen.getByRole("navigation")).queryByText("Page content")).toBeNull();
  });
});
