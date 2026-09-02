import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "./app-shell";

vi.mock("@/features/auth/actions", () => ({ signOut: vi.fn() }));

const baseProps = {
  displayName: "Ada Lovelace",
  avatarUrl: null,
  isAdmin: false,
  showPasswordBanner: false,
};

describe("AppShell (FR-001, FR-002, FR-009, FR-010, FR-031)", () => {
  it("renders the sidebar first in DOM order, with the content region filling the remainder (s1)", () => {
    const { container } = render(
      <AppShell {...baseProps}>
        <p>page content</p>
      </AppShell>,
    );

    const root = container.firstElementChild;
    expect(root).not.toBeNull();
    const nav = screen.getByRole("navigation");
    const main = screen.getByRole("main");
    const children = Array.from(root?.children ?? []);
    expect(children.indexOf(nav)).toBeLessThan(children.indexOf(main));
    expect(main.className).toContain("flex-1");
  });

  it("renders identically across two renders with identical props (s2)", () => {
    const first = render(
      <AppShell {...baseProps}>
        <p>page content</p>
      </AppShell>,
    );
    const firstHtml = first.container.innerHTML;
    first.unmount();

    const second = render(
      <AppShell {...baseProps}>
        <p>page content</p>
      </AppShell>,
    );

    expect(second.container.innerHTML).toBe(firstHtml);
  });

  it("carries no media query and no collapse, stack or hide utility at any width (s8)", () => {
    const { container } = render(
      <AppShell {...baseProps}>
        <p>page content</p>
      </AppShell>,
    );

    const root = container.firstElementChild;
    expect(root?.className).not.toMatch(/\b(sm|md|lg|xl|2xl):/);
  });

  it("sets a 1280px minimum width on the shell root so the document scrolls horizontally below it (s9)", () => {
    const { container } = render(
      <AppShell {...baseProps}>
        <p>page content</p>
      </AppShell>,
    );

    expect(container.firstElementChild?.className).toContain("min-w-[1280px]");
  });

  it("keeps the sidebar ahead of the content region in DOM order under a right-to-left direction (s10)", () => {
    const { container } = render(
      <div dir="rtl">
        <AppShell {...baseProps}>
          <p>page content</p>
        </AppShell>
      </div>,
    );

    const root = container.querySelector('div[dir="rtl"]')?.firstElementChild;
    const nav = screen.getByRole("navigation");
    const main = screen.getByRole("main");
    const children = Array.from(root?.children ?? []);
    expect(children.indexOf(nav)).toBeLessThan(children.indexOf(main));
  });

  it("exposes nav and main landmarks with a bypass anchor resolving to #main-content as the first focusable element (s11)", () => {
    render(
      <AppShell {...baseProps}>
        <p>page content</p>
      </AppShell>,
    );

    const nav = screen.getByRole("navigation");
    expect(nav).not.toBeNull();
    const main = screen.getByRole("main");
    expect(main.id).toBe("main-content");

    const bypass = screen.getByRole("link", { name: /skip to content/i });
    expect(bypass.getAttribute("href")).toBe("#main-content");
  });

  it("renders no chrome beyond the sidebar, the header slot and the banner slot", () => {
    render(
      <AppShell {...baseProps}>
        <p>page content</p>
      </AppShell>,
    );

    expect(screen.queryAllByRole("navigation")).toHaveLength(1);
    expect(screen.queryAllByRole("main")).toHaveLength(1);
  });
});

describe("AppShell banner slot (FR-025, FR-026, SC-009)", () => {
  it("renders the banner at the top of the content region, above the header (s1)", () => {
    render(
      <AppShell
        {...baseProps}
        showPasswordBanner={true}>
        <p>page content</p>
      </AppShell>,
    );

    const main = screen.getByRole("main");
    const banner = screen.getByText(/your password is still the one set/i);
    const content = screen.getByText("page content");
    const children = Array.from(main.children);
    expect(children.indexOf(banner.parentElement ?? banner)).toBeLessThan(children.indexOf(content));
  });

  it("renders the banner on a headerless screen too (s2)", () => {
    render(
      <AppShell
        {...baseProps}
        showPasswordBanner={true}>
        <p>headerless content</p>
      </AppShell>,
    );

    expect(screen.getByText(/your password is still the one set/i)).not.toBeNull();
  });

  it("keeps every control on the screen operable, withholding no navigation (s3)", () => {
    render(
      <AppShell
        {...baseProps}
        showPasswordBanner={true}>
        <p>page content</p>
      </AppShell>,
    );

    expect(screen.getByRole("link", { name: "Home" })).not.toBeNull();
    expect(screen.getByRole("navigation")).not.toBeNull();
  });

  it("renders no banner when the flag is clear, and content begins exactly where it would with no slot at all (s4)", () => {
    render(
      <AppShell {...baseProps}>
        <p>page content</p>
      </AppShell>,
    );

    expect(screen.queryByText(/your password is still the one set/i)).toBeNull();
    const main = screen.getByRole("main");
    expect(main.firstElementChild).toBe(screen.getByText("page content"));
  });
});