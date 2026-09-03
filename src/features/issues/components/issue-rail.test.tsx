import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { UpdateIssuePayload, UpdateIssueResult } from "../actions";
import type { PublicUser } from "../server/issue-queries";
import { IssueRail } from "./issue-rail";

afterEach(() => {
  vi.restoreAllMocks();
});

const COLUMNS = [
  { id: "col-open", name: "In progress" },
  { id: "col-done", name: "Done" },
  { id: "col-canceled", name: "Canceled" },
];

const ASSIGNEE_POOL = [
  { id: "user-2", firstName: "Alan", lastName: "Turing", avatarUrl: null, jobTitle: null },
];

const ALAN_TURING: PublicUser = {
  id: "user-2",
  firstName: "Alan",
  lastName: "Turing",
  avatarUrl: null,
  role: "member",
  jobTitle: null,
  deactivatedAt: null,
};

function renderRail(
  updateIssueAction: (input: UpdateIssuePayload) => Promise<UpdateIssueResult>,
  overrides: Partial<{
    column: { id: string; name: string };
    priority: "none" | "low" | "medium" | "high" | "urgent";
    assignee: PublicUser | null;
    dueDate: string | null;
    columns: { id: string; name: string }[];
    assigneePool: typeof ASSIGNEE_POOL;
  }> = {},
) {
  return render(
    <IssueRail
      issueId="issue-1"
      column={overrides.column ?? { id: "col-open", name: "In progress" }}
      priority={overrides.priority ?? "none"}
      assignee={overrides.assignee ?? null}
      dueDate={overrides.dueDate ?? null}
      columns={overrides.columns ?? COLUMNS}
      assigneePool={overrides.assigneePool ?? ASSIGNEE_POOL}
      updateIssueAction={updateIssueAction}
    />,
  );
}

describe("IssueRail — four quick-change controls, each one updateIssue call (FR-051, FR-052)", () => {
  it("changes the column with exactly one call", async () => {
    const updateIssueAction = vi
      .fn<(input: UpdateIssuePayload) => Promise<UpdateIssueResult>>()
      .mockResolvedValue({ status: "ok" });
    renderRail(updateIssueAction);

    fireEvent.click(screen.getByLabelText("Column"));
    fireEvent.click(screen.getByRole("option", { name: "Done" }));

    expect(updateIssueAction).toHaveBeenCalledTimes(1);
    expect(updateIssueAction).toHaveBeenCalledWith({ issueId: "issue-1", columnId: "col-done" });
  });

  it("changes the priority with exactly one call", async () => {
    const updateIssueAction = vi
      .fn<(input: UpdateIssuePayload) => Promise<UpdateIssueResult>>()
      .mockResolvedValue({ status: "ok" });
    renderRail(updateIssueAction);

    fireEvent.click(screen.getByLabelText("Priority"));
    fireEvent.click(screen.getByRole("option", { name: "Urgent" }));

    expect(updateIssueAction).toHaveBeenCalledTimes(1);
    expect(updateIssueAction).toHaveBeenCalledWith({ issueId: "issue-1", priority: "urgent" });
  });

  it("changes the assignee with exactly one call", async () => {
    const updateIssueAction = vi
      .fn<(input: UpdateIssuePayload) => Promise<UpdateIssueResult>>()
      .mockResolvedValue({ status: "ok" });
    renderRail(updateIssueAction);

    fireEvent.click(screen.getByLabelText("Assignee"));
    fireEvent.click(screen.getByRole("option", { name: "Alan Turing" }));

    expect(updateIssueAction).toHaveBeenCalledTimes(1);
    expect(updateIssueAction).toHaveBeenCalledWith({ issueId: "issue-1", assigneeId: "user-2" });
  });

  it("changes the due date with exactly one call", async () => {
    const updateIssueAction = vi
      .fn<(input: UpdateIssuePayload) => Promise<UpdateIssueResult>>()
      .mockResolvedValue({ status: "ok" });
    renderRail(updateIssueAction);

    fireEvent.change(screen.getByLabelText("Due date"), { target: { value: "2026-06-15" } });

    expect(updateIssueAction).toHaveBeenCalledTimes(1);
    expect(updateIssueAction).toHaveBeenCalledWith({ issueId: "issue-1", dueDate: "2026-06-15" });
  });

  it("offers only this project's columns, and no other's", async () => {
    const updateIssueAction = vi.fn<(input: UpdateIssuePayload) => Promise<UpdateIssueResult>>();
    renderRail(updateIssueAction);

    fireEvent.click(screen.getByLabelText("Column"));

    expect(screen.getByRole("option", { name: "In progress" })).not.toBeNull();
    expect(screen.getByRole("option", { name: "Done" })).not.toBeNull();
    expect(screen.getByRole("option", { name: "Canceled" })).not.toBeNull();
    expect(screen.queryByRole("option", { name: "Some other project's column" })).toBeNull();
  });

  it("clears the assignee", async () => {
    const updateIssueAction = vi
      .fn<(input: UpdateIssuePayload) => Promise<UpdateIssueResult>>()
      .mockResolvedValue({ status: "ok" });
    renderRail(updateIssueAction, {
      assignee: ALAN_TURING,
    });

    fireEvent.click(screen.getByLabelText("Assignee"));
    fireEvent.click(screen.getByRole("option", { name: "Unassigned" }));

    expect(updateIssueAction).toHaveBeenCalledWith({ issueId: "issue-1", assigneeId: null });
  });

  it("clears the due date", async () => {
    const updateIssueAction = vi
      .fn<(input: UpdateIssuePayload) => Promise<UpdateIssueResult>>()
      .mockResolvedValue({ status: "ok" });
    renderRail(updateIssueAction, { dueDate: "2026-06-15" });

    fireEvent.change(screen.getByLabelText("Due date"), { target: { value: "" } });

    expect(updateIssueAction).toHaveBeenCalledWith({ issueId: "issue-1", dueDate: null });
  });
});

describe("IssueRail — column transitions, including the canceled-kind route (FR-053, FR-056, US3 s5, s6, US5 s3)", () => {
  it("offers a move into the canceled-kind column like any other, with no confirmation", async () => {
    const updateIssueAction = vi
      .fn<(input: UpdateIssuePayload) => Promise<UpdateIssueResult>>()
      .mockResolvedValue({ status: "ok" });
    renderRail(updateIssueAction);

    fireEvent.click(screen.getByLabelText("Column"));
    fireEvent.click(screen.getByRole("option", { name: "Canceled" }));

    expect(updateIssueAction).toHaveBeenCalledWith({ issueId: "issue-1", columnId: "col-canceled" });
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("offers a move out of the canceled-kind column, with no confirmation", async () => {
    const updateIssueAction = vi
      .fn<(input: UpdateIssuePayload) => Promise<UpdateIssueResult>>()
      .mockResolvedValue({ status: "ok" });
    renderRail(updateIssueAction, { column: { id: "col-canceled", name: "Canceled" } });

    fireEvent.click(screen.getByLabelText("Column"));
    fireEvent.click(screen.getByRole("option", { name: "Done" }));

    expect(updateIssueAction).toHaveBeenCalledWith({ issueId: "issue-1", columnId: "col-done" });
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("offers a single option, already the issue's own, when the project holds exactly one column, and no transition is refused", async () => {
    const updateIssueAction = vi.fn<(input: UpdateIssuePayload) => Promise<UpdateIssueResult>>();
    renderRail(updateIssueAction, {
      column: { id: "col-only", name: "Backlog" },
      columns: [{ id: "col-only", name: "Backlog" }],
    });

    fireEvent.click(screen.getByLabelText("Column"));

    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("option", { name: "Backlog" })).not.toBeNull();
    expect(updateIssueAction).not.toHaveBeenCalled();
  });
});