import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ProjectProgressRow as ProjectProgressRowData } from "../server/project-queries";
import { ProjectProgressRow } from "./project-progress-row";

function row(overrides: Partial<ProjectProgressRowData> = {}): ProjectProgressRowData {
  return {
    key: "WEB",
    name: "Website Redesign",
    status: "active",
    href: "/projects/WEB",
    done: 3,
    counted: 8,
    ...overrides,
  };
}

describe("ProjectProgressRow (FR-016, FR-019, FR-042)", () => {
  it("renders the project's name, its status and its whole-number percentage", () => {
    render(<ProjectProgressRow row={row()} />);

    expect(screen.getByText("Website Redesign")).not.toBeNull();
    expect(screen.getByText("active")).not.toBeNull();
    expect(screen.getByText("38%")).not.toBeNull();
  });

  it("links to the project it names", () => {
    render(<ProjectProgressRow row={row()} />);

    expect(screen.getByRole("link").getAttribute("href")).toBe("/projects/WEB");
  });

  it("takes its accessible name from its own text", () => {
    render(<ProjectProgressRow row={row()} />);

    expect(screen.getByRole("link", { name: /Website Redesign/ })).not.toBeNull();
  });

  it("is a native anchor the platform makes keyboard operable, with the shared focus outline intact", () => {
    render(<ProjectProgressRow row={row()} />);

    const link = screen.getByRole("link");
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).not.toBe("");
    expect(link.className).not.toMatch(/outline-none/);
  });

  it("takes focus", () => {
    render(<ProjectProgressRow row={row()} />);

    const link = screen.getByRole("link");
    link.focus();

    expect(document.activeElement).toBe(link);
  });
});

describe("ProjectProgressRow never renders a blank, a dash, an 'n/a' or an error (FR-018, SC-004)", () => {
  it("reads 0% for a project with no counted issues", () => {
    render(<ProjectProgressRow row={row({ done: 0, counted: 0 })} />);

    expect(screen.getByText("0%")).not.toBeNull();
    expect(screen.queryByText("—")).toBeNull();
    expect(screen.queryByText(/n\/a/i)).toBeNull();
  });

  it("reads 99% rather than 100% while one counted issue is open", () => {
    render(<ProjectProgressRow row={row({ done: 199, counted: 200 })} />);

    expect(screen.getByText("99%")).not.toBeNull();
  });

  it("reads 100% when every counted issue is done", () => {
    render(<ProjectProgressRow row={row({ done: 200, counted: 200 })} />);

    expect(screen.getByText("100%")).not.toBeNull();
  });
});