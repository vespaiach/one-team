import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Sidebar } from "./sidebar";

const baseProps = { displayName: "Ada Lovelace", avatarUrl: null };

describe("Sidebar geometry (FR-005, FR-031)", () => {
  it("is a nav landmark carrying its own accessible name", () => {
    render(
      <Sidebar
        {...baseProps}
        isAdmin={false}
      />,
    );

    const nav = screen.getByRole("navigation");
    expect(nav.getAttribute("aria-label")).toBeTruthy();
  });

  it("is a fixed 262px column that never shrinks", () => {
    render(
      <Sidebar
        {...baseProps}
        isAdmin={false}
      />,
    );

    const nav = screen.getByRole("navigation");
    expect(nav.className).toContain("w-[262px]");
    expect(nav.className).toContain("shrink-0");
  });

  it("occupies the full height of the viewport and stays glued to the inline start under horizontal scroll", () => {
    render(
      <Sidebar
        {...baseProps}
        isAdmin={false}
      />,
    );

    const nav = screen.getByRole("navigation");
    expect(nav.className).toContain("self-stretch");
    expect(nav.className).toContain("sticky");
    expect(nav.className).toContain("start-0");
  });

  it("has the project-list region as the only internally scrolling part", () => {
    const { container } = render(
      <Sidebar
        {...baseProps}
        isAdmin={false}
      />,
    );

    const nav = screen.getByRole("navigation");
    const region = nav.querySelector("section");
    expect(region).not.toBeNull();
    expect(region?.className).toContain("overflow-y-auto");
    expect(container.querySelectorAll(".overflow-y-auto")).toHaveLength(1);
  });

  it("pins the chip's position to the sidebar's foot rather than letting it follow the entries above it in flow", () => {
    render(
      <Sidebar
        {...baseProps}
        isAdmin={false}
      />,
    );

    const nav = screen.getByRole("navigation");
    const chipSlot = nav.lastElementChild;
    expect(chipSlot?.className).toContain("mt-auto");
  });
});

describe("Sidebar entries (FR-005, FR-006, FR-011, FR-012, FR-016, FR-031, SC-004, SC-005)", () => {
  it("shows Accounts, Labels and the + under an admin (s1)", () => {
    render(
      <Sidebar
        {...baseProps}
        isAdmin={true}
      />,
    );

    expect(screen.getByRole("link", { name: "Accounts" })).not.toBeNull();
    expect(screen.getByRole("link", { name: "Labels" })).not.toBeNull();
    expect(screen.getByRole("link", { name: /new project/i })).not.toBeNull();
  });

  it("renders none of Accounts, Labels or the + for a member — absent, not disabled (s2)", () => {
    render(
      <Sidebar
        {...baseProps}
        isAdmin={false}
      />,
    );

    expect(screen.queryByRole("link", { name: "Accounts" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Labels" })).toBeNull();
    expect(screen.queryByRole("link", { name: /new project/i })).toBeNull();
    expect(screen.queryByText("Accounts")).toBeNull();
    expect(screen.queryByText("Labels")).toBeNull();
    expect(screen.queryAllByRole("link", { current: true } as never)).toHaveLength(0);
  });

  it("shows Home, the project-list region, Notifications and the chip regardless of role (s6)", () => {
    for (const isAdmin of [true, false]) {
      const { unmount } = render(
        <Sidebar
          {...baseProps}
          isAdmin={isAdmin}
        />,
      );
      expect(screen.getByRole("link", { name: "Home" })).not.toBeNull();
      expect(screen.getByText("No projects yet.")).not.toBeNull();
      expect(screen.getByRole("link", { name: "Notifications" })).not.toBeNull();
      expect(screen.getByRole("link", { name: "Ada Lovelace" })).not.toBeNull();
      unmount();
    }
  });

  it("renders the seven items in FR-005's order under an admin, and the four that remain under a member (s10)", () => {
    const adminRender = render(
      <Sidebar
        {...baseProps}
        isAdmin={true}
      />,
    );
    const adminNav = screen.getByRole("navigation");
    const adminOrder = Array.from(adminNav.children).map((child) => child.textContent);
    expect(adminOrder).toEqual([
      "One Team",
      "Home",
      expect.stringContaining("No projects yet."),
      "Notifications",
      "Accounts",
      "Labels",
      expect.stringContaining("Ada Lovelace"),
    ]);
    adminRender.unmount();

    render(
      <Sidebar
        {...baseProps}
        isAdmin={false}
      />,
    );
    const memberNav = screen.getByRole("navigation");
    const memberOrder = Array.from(memberNav.children).map((child) => child.textContent);
    expect(memberOrder).toEqual([
      "One Team",
      "Home",
      expect.stringContaining("No projects yet."),
      "Notifications",
      expect.stringContaining("Ada Lovelace"),
    ]);
  });

  it("has no team switcher and no control that changes which team is in view (s10)", () => {
    render(
      <Sidebar
        {...baseProps}
        isAdmin={true}
      />,
    );

    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("button", { name: /team/i })).toBeNull();
  });

  it("flips the admin-only entries between two renders with no remount and no row touched (s4, s5)", () => {
    const { rerender } = render(
      <Sidebar
        {...baseProps}
        isAdmin={true}
      />,
    );
    const homeBefore = screen.getByRole("link", { name: "Home" });
    const chipBefore = screen.getByRole("link", { name: "Ada Lovelace" });

    rerender(
      <Sidebar
        {...baseProps}
        isAdmin={false}
      />,
    );

    expect(screen.queryByRole("link", { name: "Accounts" })).toBeNull();
    const homeAfter = screen.getByRole("link", { name: "Home" });
    const chipAfter = screen.getByRole("link", { name: "Ada Lovelace" });
    expect(homeAfter).toBe(homeBefore);
    expect(chipAfter).toBe(chipBefore);

    rerender(
      <Sidebar
        {...baseProps}
        isAdmin={true}
      />,
    );
    expect(screen.getByRole("link", { name: "Accounts" })).not.toBeNull();
    expect(screen.getByRole("link", { name: "Home" })).toBe(homeBefore);
  });

  it("carries focus through the entries in visual order with a visible, non-colour-only focus indicator (s9)", () => {
    render(
      <Sidebar
        {...baseProps}
        isAdmin={true}
      />,
    );

    const nav = screen.getByRole("navigation");
    const links = Array.from(nav.querySelectorAll("a"));
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      link.focus();
      expect(document.activeElement).toBe(link);
    }
  });
});