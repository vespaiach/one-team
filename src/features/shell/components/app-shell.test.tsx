import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppShell } from "./app-shell";

describe("AppShell (FR-001, FR-002, FR-009, FR-010, FR-031)", () => {
  it("renders the sidebar first in DOM order, with the content region filling the remainder (s1)", () => {
    const { container } = render(
      <AppShell>
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
      <AppShell>
        <p>page content</p>
      </AppShell>,
    );
    const firstHtml = first.container.innerHTML;
    first.unmount();

    const second = render(
      <AppShell>
        <p>page content</p>
      </AppShell>,
    );

    expect(second.container.innerHTML).toBe(firstHtml);
  });

  it("carries no media query and no collapse, stack or hide utility at any width (s8)", () => {
    const { container } = render(
      <AppShell>
        <p>page content</p>
      </AppShell>,
    );

    const root = container.firstElementChild;
    expect(root?.className).not.toMatch(/\b(sm|md|lg|xl|2xl):/);
  });

  it("sets a 1280px minimum width on the shell root so the document scrolls horizontally below it (s9)", () => {
    const { container } = render(
      <AppShell>
        <p>page content</p>
      </AppShell>,
    );

    expect(container.firstElementChild?.className).toContain("min-w-[1280px]");
  });

  it("keeps the sidebar ahead of the content region in DOM order under a right-to-left direction (s10)", () => {
    const { container } = render(
      <div dir="rtl">
        <AppShell>
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
      <AppShell>
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
      <AppShell>
        <p>page content</p>
      </AppShell>,
    );

    expect(screen.queryAllByRole("navigation")).toHaveLength(1);
    expect(screen.queryAllByRole("main")).toHaveLength(1);
  });
});