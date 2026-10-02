import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NotAllowed } from "./NotAllowed.tsx";

const hadGetEntriesByType = typeof performance.getEntriesByType === "function";

function stubNavigationEntryName(name: string) {
  const entries = [{ name, entryType: "navigation" }] as unknown as PerformanceEntryList;
  const getEntriesByType = (type: string) => (type === "navigation" ? entries : []);
  if (hadGetEntriesByType) {
    vi.spyOn(performance, "getEntriesByType").mockImplementation(getEntriesByType);
  } else {
    Object.defineProperty(performance, "getEntriesByType", {
      value: getEntriesByType,
      configurable: true,
      writable: true,
    });
  }
}

const message = "You don't have permission to do that.";

afterEach(() => {
  vi.restoreAllMocks();
  if (!hadGetEntriesByType) {
    Reflect.deleteProperty(performance, "getEntriesByType");
  }
});

describe("NotAllowed", () => {
  it("shows the message as a focusable heading and a link to My issues", () => {
    stubNavigationEntryName(window.location.href);
    render(<NotAllowed />);
    const heading = screen.getByRole("heading", { name: message });
    expect(heading.getAttribute("tabindex")).toBe("-1");
    expect(screen.getByRole("link", { name: "My issues" }).getAttribute("href")).toBe("/my-issues");
  });

  it("focuses the heading after an in-app navigation", () => {
    stubNavigationEntryName(new URL("/some-earlier-page", window.location.href).href);
    render(<NotAllowed />);
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: message }));
  });

  it("leaves focus at the browser default on a full page load", () => {
    stubNavigationEntryName(window.location.href);
    render(<NotAllowed />);
    expect(document.activeElement).not.toBe(screen.getByRole("heading", { name: message }));
    expect(document.activeElement).toBe(document.body);
  });
});