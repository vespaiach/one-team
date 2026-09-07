import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { AssignedIssueRow as AssignedIssue } from "../server/assigned-queries";
import { AssignedIssueRow } from "./assigned-issue-row";

function issue(overrides: Partial<AssignedIssue> = {}): AssignedIssue {
  return {
    id: "i1",
    key: "WEB-142",
    title: "Fix the header",
    projectName: "Website Redesign",
    href: "/projects/WEB/issues/142/details",
    dueThisWeek: false,
    ...overrides,
  };
}

describe("AssignedIssueRow names its issue across projects (FR-011)", () => {
  it("renders the issue key, the title and the project the issue belongs to", () => {
    render(<AssignedIssueRow issue={issue()} />);

    expect(screen.getByText("WEB-142")).not.toBeNull();
    expect(screen.getByText("Fix the header")).not.toBeNull();
    expect(screen.getByText("Website Redesign")).not.toBeNull();
  });
});

describe("AssignedIssueRow links to the issue's details route (FR-013, FR-042)", () => {
  it("is an anchor to the row's own href, named by its own text", () => {
    render(<AssignedIssueRow issue={issue()} />);

    const link = screen.getByRole("link", { name: /WEB-142/ });

    expect(link.getAttribute("href")).toBe("/projects/WEB/issues/142/details");
    expect(link.textContent).toContain("Fix the header");
    expect(link.textContent).toContain("Website Redesign");
  });

  it("is reachable and operable by keyboard, and keeps the application's visible focus indicator", () => {
    render(<AssignedIssueRow issue={issue()} />);

    const link = screen.getByRole("link", { name: /WEB-142/ });

    expect(link.getAttribute("tabindex")).toBeNull();

    link.focus();
    expect(document.activeElement).toBe(link);

    fireEvent.keyDown(link, { key: "Enter" });
    expect(document.activeElement).toBe(link);

    fireEvent.keyDown(link, { key: "Tab" });
    expect(link.className).not.toContain("outline-none");
  });
});

describe("AssignedIssueRow changes nothing (FR-004, FR-043, E-1)", () => {
  it("renders no control that could mutate anything", () => {
    const { container } = render(<AssignedIssueRow issue={issue()} />);

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(container.querySelector("form")).toBeNull();
    expect(container.querySelector("input")).toBeNull();
  });

  it("is a Server Component built on next/link, with no react-aria-components import", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/features/home/components/assigned-issue-row.tsx"),
      "utf8",
    );

    expect(source).not.toContain('"use client"');
    expect(source).not.toContain('"use server"');
    expect(source).not.toContain("react-aria-components");
    expect(source).not.toContain("RouterProvider");
    expect(source).toContain('from "next/link"');
  });
});