import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NewIssueControl } from "./new-issue-control";

const REASON = "Only project members can create issues in Website Redesign.";

describe("NewIssueControl — a member's destination (FR-028, US4 s3)", () => {
  it("points at this project's create-issue route", () => {
    render(
      <NewIssueControl
        projectKey="WEB"
        canWrite={true}
        writeReason=""
      />,
    );

    const link = screen.getByRole("link", { name: "New issue" });
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("/projects/WEB/issues/new");
  });
});

describe("NewIssueControl — a non-member's boundary (FR-028, OT-UX-021, US4 s3)", () => {
  it("is visible and disabled, carrying a reason naming the project — never hidden", () => {
    render(
      <NewIssueControl
        projectKey="WEB"
        canWrite={false}
        writeReason={REASON}
      />,
    );

    const control = screen.getByRole("link", { name: "New issue" });
    expect(control.getAttribute("aria-disabled")).toBe("true");
    expect(control.tagName).not.toBe("A");
    expect(screen.getByText(REASON)).toBeDefined();
  });

  it("associates the reason with the control itself, not merely adjacent text", () => {
    render(
      <NewIssueControl
        projectKey="WEB"
        canWrite={false}
        writeReason={REASON}
      />,
    );

    const control = screen.getByRole("link", { name: "New issue" });
    const describedBy = control.getAttribute("aria-describedby");
    expect(describedBy).not.toBeNull();
    const described = document.getElementById(describedBy as string);
    expect(described?.textContent).toBe(REASON);
  });
});