import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "../components/layout/AppShell.tsx";
import NotFound from "./not-found.tsx";

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

function renderNotFound() {
  render(
    <AppShell>
      <NotFound />
    </AppShell>,
  );
  return within(screen.getByRole("main"));
}

afterEach(() => {
  vi.restoreAllMocks();
  if (!hadGetEntriesByType) {
    Reflect.deleteProperty(performance, "getEntriesByType");
  }
});

describe("Not found page", () => {
  it("shows the heading and a link to My issues inside the shell", () => {
    stubNavigationEntryName(window.location.href);
    const main = renderNotFound();
    expect(main.getByRole("heading", { name: "Not found" })).toBeTruthy();
    expect(main.getByRole("link", { name: "My issues" }).getAttribute("href")).toBe("/my-issues");
  });

  it("focuses the heading after a client-side navigation", () => {
    stubNavigationEntryName(new URL("/some-earlier-page", window.location.href).href);
    const main = renderNotFound();
    expect(document.activeElement).toBe(main.getByRole("heading", { name: "Not found" }));
  });

  it("leaves focus at the browser default on a full page load", () => {
    stubNavigationEntryName(window.location.href);
    const main = renderNotFound();
    expect(document.activeElement).not.toBe(main.getByRole("heading", { name: "Not found" }));
    expect(document.activeElement).toBe(document.body);
  });
});