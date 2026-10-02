import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import MyIssuesPage, { metadata } from "./page.tsx";

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

afterEach(() => {
  vi.restoreAllMocks();
  if (!hadGetEntriesByType) {
    Reflect.deleteProperty(performance, "getEntriesByType");
  }
});

describe("My issues page", () => {
  it("shows the My issues heading and the empty state", () => {
    stubNavigationEntryName(window.location.href);
    render(<MyIssuesPage />);
    expect(screen.getByRole("heading", { name: "My issues" })).toBeTruthy();
    expect(screen.getByText("Nothing assigned to you")).toBeTruthy();
  });

  it("has the document title My issues", () => {
    expect(metadata.title).toBe("My issues");
  });

  it("focuses the heading after an in-app navigation", () => {
    stubNavigationEntryName(new URL("/some-earlier-page", window.location.href).href);
    render(<MyIssuesPage />);
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "My issues" }));
  });

  it("leaves focus at the browser default on a full page load", () => {
    stubNavigationEntryName(window.location.href);
    render(<MyIssuesPage />);
    expect(document.activeElement).not.toBe(screen.getByRole("heading", { name: "My issues" }));
    expect(document.activeElement).toBe(document.body);
  });
});