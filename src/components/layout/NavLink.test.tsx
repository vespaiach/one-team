import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NavLink } from "./NavLink.tsx";

const navigation = vi.hoisted(() => ({ pathname: "/my-issues" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
}));

function renderLink(pathname: string) {
  navigation.pathname = pathname;
  render(<NavLink href="/my-issues">My issues</NavLink>);
  return screen.getByRole("link", { name: "My issues" });
}

afterEach(() => {
  navigation.pathname = "/my-issues";
});

describe("NavLink", () => {
  it("renders a link with its label and href", () => {
    const link = renderLink("/project/WEB");
    expect(link.textContent).toBe("My issues");
    expect(link.getAttribute("href")).toBe("/my-issues");
  });

  it('has aria-current="page" when the pathname equals its href', () => {
    const link = renderLink("/my-issues");
    expect(link.getAttribute("aria-current")).toBe("page");
  });

  it.each(["/", "/project/WEB", "/my-issues/extra", "/my-issue"])(
    "has no aria-current when the pathname is %s",
    (pathname) => {
      const link = renderLink(pathname);
      expect(link.hasAttribute("aria-current")).toBe(false);
    },
  );

  it("is focusable with a visible focus ring", () => {
    const link = renderLink("/my-issues");
    expect(link.tabIndex).toBeGreaterThanOrEqual(0);
    link.focus();
    expect(document.activeElement).toBe(link);

    const classes = link.className.split(/\s+/).filter(Boolean);
    const removesOutline = classes.some((name) => /^(outline-none|outline-hidden|outline-0)$/.test(name));
    const restoresRing = classes.some((name) => /^focus-visible:(outline|ring)/.test(name));
    expect(!removesOutline || restoresRing).toBe(true);
  });
});