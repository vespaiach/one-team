import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
    createColumn: vi.fn().mockResolvedValue({ ok: true }),
    updateColumn: vi.fn().mockResolvedValue({ ok: true }),
    moveColumn: vi.fn().mockResolvedValue({ ok: true }),
    deleteColumn: vi.fn().mockResolvedValue({ ok: true }),
    deleteProjectAction: vi.fn().mockResolvedValue({ status: "deleted" }),
    ...overrides,
  };
}

function projectDeleteControl() {
  const outsideTheColumns = screen
    .getAllByRole("button", { name: "Delete" })
    .filter((button) => button.closest('[role="grid"]') === null);
  expect(outsideTheColumns).toHaveLength(1);
  return outsideTheColumns[0] as HTMLElement;
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
      { id: "1", name: "Backlog", kind: "open", position: 0, issueCount: 0, deleteRefusal: null },
      { id: "2", name: "Todo", kind: "open", position: 1, issueCount: 0, deleteRefusal: null },
      { id: "3", name: "In Progress", kind: "open", position: 2, issueCount: 0, deleteRefusal: null },
      { id: "4", name: "Done", kind: "done", position: 3, issueCount: 0, deleteRefusal: null },
      { id: "5", name: "Canceled", kind: "canceled", position: 4, issueCount: 0, deleteRefusal: null },
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

  it("passes the project's own live comment count through to the header (FR-059)", () => {
    render(
      <ProjectDetailsScreen
        details={makeDetails()}
        updateProjectAction={vi.fn()}
        commentCount={7}
      />,
    );

    expect(screen.getByText("7 comments")).not.toBeNull();
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
    const deleteButton = projectDeleteControl();
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

    const deleteButton = projectDeleteControl();
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

    const deleteButton = projectDeleteControl();
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
describe("ProjectDetailsScreen — the column actions (FR-013, contracts/screens.md)", () => {
  it("carries createColumn and updateColumn alongside the other admin actions", () => {
    const admin = adminBundle();
    render(
      <ProjectDetailsScreen
        details={makeDetails()}
        updateProjectAction={vi.fn()}
        admin={admin}
      />,
    );

    expect(screen.getByRole("button", { name: "Add column" })).not.toBeNull();
    expect(screen.getAllByRole("button", { name: "Column name" })).toHaveLength(5);
  });

  it("passes the project key through to the add form", async () => {
    const admin = adminBundle();
    render(
      <ProjectDetailsScreen
        details={makeDetails()}
        updateProjectAction={vi.fn()}
        admin={admin}
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Column name" }), { target: { value: "Review" } });
    fireEvent.click(screen.getByRole("button", { name: "Add column" }));

    await waitFor(() =>
      expect(admin.createColumn).toHaveBeenCalledWith({ projectKey: "WR", name: "Review" }),
    );
  });

  it("gives a non-admin none of them, and ColumnsSection no admin prop", () => {
    render(
      <ProjectDetailsScreen
        details={makeDetails({ canEditRecord: false, canAdminister: false })}
        updateProjectAction={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Add column" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Column name" })).toBeNull();
    expect(screen.queryByRole("textbox", { name: "Column name" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Drag Backlog" })).toBeNull();
    for (const row of screen.getAllByRole("row")) {
      expect(within(row).queryAllByRole("button")).toHaveLength(0);
    }
  });

  it("carries deleteColumn through to every column row (FR-013)", async () => {
    const admin = adminBundle();
    render(
      <ProjectDetailsScreen
        details={makeDetails()}
        updateProjectAction={vi.fn()}
        admin={admin}
      />,
    );

    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(5);
    for (const row of rows) {
      expect(within(row).getByRole("button", { name: "Delete" })).not.toBeNull();
    }

    fireEvent.click(within(rows[0] as HTMLElement).getByRole("button", { name: "Delete" }));

    expect((await screen.findByRole("dialog")).textContent).toContain("Backlog");
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));

    await waitFor(() => expect(admin.deleteColumn).toHaveBeenCalledWith({ columnId: "1" }));
    expect(admin.deleteColumn).toHaveBeenCalledTimes(1);
  });

  it("carries moveColumn through to the columns section (FR-013)", async () => {
    const admin = adminBundle();
    render(
      <ProjectDetailsScreen
        details={makeDetails()}
        updateProjectAction={vi.fn()}
        admin={admin}
      />,
    );

    const handle = screen.getByRole("button", { name: "Drag Backlog" });
    handle.focus();
    fireEvent.keyDown(handle, { key: "Enter" });
    fireEvent.keyUp(handle, { key: "Enter" });
    const onDropIndicator = async () => {
      await waitFor(() =>
        expect((document.activeElement as HTMLElement).getAttribute("aria-label")).toMatch(/^Insert/),
      );
      return (document.activeElement as HTMLElement).getAttribute("aria-label");
    };
    await onDropIndicator();
    for (let step = 0; step < 12; step += 1) {
      if ((await onDropIndicator()) === "Insert between Done and Canceled") {
        break;
      }
      fireEvent.keyDown(document.activeElement as HTMLElement, { key: "ArrowDown" });
      fireEvent.keyUp(document.activeElement as HTMLElement, { key: "ArrowDown" });
    }
    const dropTarget = document.activeElement as HTMLElement;
    expect(dropTarget.getAttribute("aria-label")).toBe("Insert between Done and Canceled");
    fireEvent.keyDown(dropTarget, { key: "Enter" });
    fireEvent.keyUp(dropTarget, { key: "Enter" });

    await waitFor(() => expect(admin.moveColumn).toHaveBeenCalledTimes(1));
    expect(admin.moveColumn).toHaveBeenCalledWith({
      columnId: "1",
      targetColumnId: "5",
      placement: "before",
    });
  });
});