import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NewIssueProjectPicker } from "./new-issue-project-picker";

const projects = [
  { key: "APOLLO", name: "Apollo Platform", status: "active" as const },
  { key: "OLD", name: "Retired Effort", status: "archived" as const },
];

describe("NewIssueProjectPicker", () => {
  it("is closed until its trigger is pressed", () => {
    render(<NewIssueProjectPicker projects={projects} />);

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: /new issue/i })).not.toBeNull();
  });

  it("lists every project as a link to that project's own create-issue page", () => {
    render(<NewIssueProjectPicker projects={projects} />);

    fireEvent.click(screen.getByRole("button", { name: /new issue/i }));

    const apollo = screen.getByRole("link", { name: /Apollo Platform/ });
    expect(apollo.getAttribute("href")).toBe("/projects/APOLLO/issues/new");
  });

  it("shows a quiet message instead of a list when there are no projects", () => {
    render(<NewIssueProjectPicker projects={[]} />);

    fireEvent.click(screen.getByRole("button", { name: /new issue/i }));

    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.getByText(/no projects yet/i)).not.toBeNull();
  });
});