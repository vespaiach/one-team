import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NewIssueProjectPicker } from "./new-issue-project-picker";

describe("NewIssueProjectPicker", () => {
  it("links each project to its board with the new-issue dialog flagged to open", () => {
    render(<NewIssueProjectPicker projects={[{ key: "APOLLO", name: "Apollo", status: "active" }]} />);

    fireEvent.click(screen.getByRole("button", { name: "New issue" }));

    const link = screen.getByRole("link", { name: "Apollo" });
    expect(link.getAttribute("href")).toBe("/projects/APOLLO?newIssue=1");
  });
});