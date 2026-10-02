import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HeadingFocus } from "./HeadingFocus.tsx";

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

function renderHeading() {
  render(
    <>
      <h1
        id="page-heading"
        tabIndex={-1}>
        Page
      </h1>
      <HeadingFocus headingId="page-heading" />
    </>,
  );
  return screen.getByRole("heading", { name: "Page" });
}

afterEach(() => {
  vi.restoreAllMocks();
  if (!hadGetEntriesByType) {
    Reflect.deleteProperty(performance, "getEntriesByType");
  }
});

describe("HeadingFocus", () => {
  it("focuses the heading after an in-app navigation", () => {
    stubNavigationEntryName(new URL("/some-earlier-page", window.location.href).href);
    const heading = renderHeading();
    expect(document.activeElement).toBe(heading);
  });

  it("leaves focus at the browser default on a full page load", () => {
    stubNavigationEntryName(window.location.href);
    renderHeading();
    expect(document.activeElement).toBe(document.body);
  });
});