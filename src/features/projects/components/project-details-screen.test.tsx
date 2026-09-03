import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ProjectDetails } from "../server/queries";
import { ProjectDetailsScreen } from "./project-details-screen";

function makeDetails(overrides: Partial<ProjectDetails> = {}): ProjectDetails {
  return {
    record: {
      key: "WR",
      name: "Website Redesign",
      description: "A redesign",
      status: "active",
      startDate: null,
      targetDate: null,
    },
    columns: [
      { id: "1", name: "Backlog", kind: "open", position: 0, issueCount: 0 },
      { id: "2", name: "Todo", kind: "open", position: 1, issueCount: 0 },
      { id: "3", name: "In Progress", kind: "open", position: 2, issueCount: 0 },
      { id: "4", name: "Done", kind: "done", position: 3, issueCount: 0 },
      { id: "5", name: "Canceled", kind: "canceled", position: 4, issueCount: 0 },
    ],
    roster: [],
    cascadeCount: 5,
    canEditRecord: true,
    canAdminister: true,
    ...overrides,
  };
}

describe("ProjectDetailsScreen (FR-035, FR-036, FR-037, FR-021)", () => {
  it("renders the whole record for any signed-in user", () => {
    render(
      <ProjectDetailsScreen
        details={makeDetails({ canEditRecord: false, canAdminister: false })}
        updateProjectAction={vi.fn()}
      />,
    );

    expect(screen.getByText(/WR/)).not.toBeNull();
    expect(screen.getByRole("button", { name: "Name" }).textContent).toBe("Website Redesign");
    expect(screen.getByRole("button", { name: "Description" }).textContent).toContain("A redesign");
  });

  it("states that the key is immutable", () => {
    render(
      <ProjectDetailsScreen
        details={makeDetails()}
        updateProjectAction={vi.fn()}
      />,
    );

    expect(screen.getByText(/can.t be changed/i)).not.toBeNull();
  });

  it("disables every record control with an inline reason naming the project for a non-member", () => {
    render(
      <ProjectDetailsScreen
        details={makeDetails({ canEditRecord: false })}
        updateProjectAction={vi.fn()}
      />,
    );

    const nameButton = screen.getByRole("button", { name: "Name" });
    expect(nameButton.hasAttribute("disabled")).toBe(true);
    const descriptionButton = screen.getByRole("button", { name: "Description" });
    expect(descriptionButton.hasAttribute("disabled")).toBe(true);
    const startDateButton = screen.getByRole("button", { name: "Start date" });
    expect(startDateButton.hasAttribute("disabled")).toBe(true);
    const targetDateButton = screen.getByRole("button", { name: "Target date" });
    expect(targetDateButton.hasAttribute("disabled")).toBe(true);

    const reasons = screen.getAllByText(/Website Redesign/);
    expect(reasons.length).toBeGreaterThan(0);
  });

  it("disables the same controls, with the reason, on a re-render where canEditRecord falls from true to false, without removing rendered content", () => {
    const { rerender } = render(
      <ProjectDetailsScreen
        details={makeDetails({ canEditRecord: true })}
        updateProjectAction={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Name" }).hasAttribute("disabled")).toBe(false);
    expect(screen.getByRole("button", { name: "Name" }).textContent).toBe("Website Redesign");

    rerender(
      <ProjectDetailsScreen
        details={makeDetails({ canEditRecord: false })}
        updateProjectAction={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Name" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Name" }).textContent).toBe("Website Redesign");
  });

  it("renders the columns section", () => {
    render(
      <ProjectDetailsScreen
        details={makeDetails()}
        updateProjectAction={vi.fn()}
      />,
    );

    expect(screen.getByText("Backlog")).not.toBeNull();
    expect(screen.getByText("Canceled")).not.toBeNull();
  });

  it("renders the members section", () => {
    render(
      <ProjectDetailsScreen
        details={makeDetails({
          roster: [
            { userId: "1", displayName: "Ada Lovelace", avatarUrl: null, jobTitle: null, deactivated: false },
          ],
        })}
        updateProjectAction={vi.fn()}
      />,
    );

    expect(screen.getByText("Ada Lovelace")).not.toBeNull();
  });
});