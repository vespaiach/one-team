import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ProjectDetails } from "../server/queries";
import type { ProjectDetailsScreenAdmin } from "./project-details-screen";
import { ProjectDetailsScreen } from "./project-details-screen";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

function adminBundle(overrides: Partial<ProjectDetailsScreenAdmin> = {}): ProjectDetailsScreenAdmin {
  return {
    candidates: [],
    addProjectMemberAction: vi.fn().mockResolvedValue({ status: "saved" }),
    removeProjectMemberAction: vi.fn().mockResolvedValue({ status: "saved" }),
    setProjectStatusAction: vi.fn().mockResolvedValue({ status: "saved" }),
    deleteProjectAction: vi.fn().mockResolvedValue({ status: "deleted" }),
    ...overrides,
  };
}

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

  it("carries the project header, current tab marked Details (FR-056)", () => {
    render(
      <ProjectDetailsScreen
        details={makeDetails()}
        updateProjectAction={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Website Redesign" })).not.toBeNull();
    expect(screen.getByRole("tab", { name: "Board" })).not.toBeNull();
    expect(screen.getByRole("tab", { name: "Details", selected: true })).not.toBeNull();
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

describe("ProjectDetailsScreen — status and delete (FR-041, FR-042, FR-047, FR-048)", () => {
  it("renders the status switch for every signed-in user, reflecting the record's status", () => {
    render(
      <ProjectDetailsScreen
        details={makeDetails({ canEditRecord: false, canAdminister: false })}
        updateProjectAction={vi.fn()}
      />,
    );

    const control = screen.getByRole("switch") as HTMLInputElement;
    expect(control.checked).toBe(false);
  });

  it("disables status and delete for a non-admin, each with a reason naming who may act", () => {
    render(
      <ProjectDetailsScreen
        details={makeDetails({ canEditRecord: false, canAdminister: false })}
        updateProjectAction={vi.fn()}
      />,
    );

    expect((screen.getByRole("switch") as HTMLInputElement).hasAttribute("disabled")).toBe(true);
    const deleteButton = screen.getByRole("button", { name: "Delete" });
    expect(deleteButton.hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("Only admins can change a project's status.")).not.toBeNull();
    expect(screen.getByText("Only admins can delete a project.")).not.toBeNull();
  });

  it("offers an admin an enabled status switch reflecting an archived project, and an enabled delete control", () => {
    render(
      <ProjectDetailsScreen
        details={makeDetails({
          record: { ...makeDetails().record, status: "archived" },
          canAdminister: true,
        })}
        updateProjectAction={vi.fn()}
        admin={adminBundle()}
      />,
    );

    const control = screen.getByRole("switch") as HTMLInputElement;
    expect(control.hasAttribute("disabled")).toBe(false);
    expect(control.checked).toBe(true);

    const deleteButton = screen.getByRole("button", { name: "Delete" });
    expect(deleteButton.hasAttribute("disabled")).toBe(false);
  });

  it("disables delete with a reason on an active project even for an admin", () => {
    render(
      <ProjectDetailsScreen
        details={makeDetails({ canAdminister: true })}
        updateProjectAction={vi.fn()}
        admin={adminBundle()}
      />,
    );

    const deleteButton = screen.getByRole("button", { name: "Delete" });
    expect(deleteButton.hasAttribute("disabled")).toBe(true);
    expect(screen.getByText(/Archive Website Redesign/)).not.toBeNull();
  });

  it("calls setProjectStatusAction with the project key and next status when an admin flips the switch", async () => {
    const setProjectStatusAction = vi.fn().mockResolvedValue({ status: "saved" });
    render(
      <ProjectDetailsScreen
        details={makeDetails({ canAdminister: true })}
        updateProjectAction={vi.fn()}
        admin={adminBundle({ setProjectStatusAction })}
      />,
    );

    fireEvent.click(screen.getByRole("switch"));

    await waitFor(() =>
      expect(setProjectStatusAction).toHaveBeenCalledWith({ projectKey: "WR", status: "archived" }),
    );
  });

  it("renders the header's New issue slot when the page supplies it (FR-028)", () => {
    render(
      <ProjectDetailsScreen
        details={makeDetails()}
        updateProjectAction={vi.fn()}
        newIssue={<span>New issue control</span>}
      />,
    );

    expect(screen.getByText("New issue control")).not.toBeNull();
  });
});