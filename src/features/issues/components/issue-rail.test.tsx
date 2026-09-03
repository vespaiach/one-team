import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IssueLabelPayload, IssueLabelResult } from "@/features/labels/actions";
import type { LabelOption } from "@/features/labels/server/queries";
import type { UpdateIssuePayload, UpdateIssueResult } from "../actions";
import type { PublicUser } from "../server/issue-queries";
import { IssueRail } from "./issue-rail";

const showToastMock = vi.fn();
vi.mock("@/features/shell/components/toast-region", () => ({
  showToast: (...args: unknown[]) => showToastMock(...args),
}));

beforeEach(() => {
  showToastMock.mockClear();
});

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

const LABEL_OPTIONS: LabelOption[] = [
  { id: "label-1", name: "Bug", applied: false },
  { id: "label-2", name: "Urgent", applied: true },
];

function renderRail(
  updateIssueAction: (input: UpdateIssuePayload) => Promise<UpdateIssueResult>,
  overrides: Partial<{
    column: { id: string; name: string };
    priority: "none" | "low" | "medium" | "high" | "urgent";
    assignee: PublicUser | null;
    dueDate: string | null;
    columns: { id: string; name: string }[];
    assigneePool: typeof ASSIGNEE_POOL;
    canWrite: boolean;
    writeReason: string;
    labelOptions: LabelOption[];
    canManageLabels: boolean;
    addIssueLabelAction: (input: IssueLabelPayload) => Promise<IssueLabelResult>;
    removeIssueLabelAction: (input: IssueLabelPayload) => Promise<IssueLabelResult>;
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
      canWrite={overrides.canWrite}
      writeReason={overrides.writeReason}
      updateIssueAction={updateIssueAction}
      labelOptions={overrides.labelOptions ?? LABEL_OPTIONS}
      canManageLabels={overrides.canManageLabels}
      addIssueLabelAction={overrides.addIssueLabelAction}
      removeIssueLabelAction={overrides.removeIssueLabelAction}
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

describe("IssueRail — the label picker, a fifth quick-change control (FR-015, FR-019, research D-4)", () => {
  it("renders every team label with its applied state", () => {
    const updateIssueAction = vi.fn<(input: UpdateIssuePayload) => Promise<UpdateIssueResult>>();
    renderRail(updateIssueAction);

    expect(screen.getByRole("option", { name: "Bug" }).getAttribute("aria-selected")).toBe("false");
    expect(screen.getByRole("option", { name: "Urgent" }).getAttribute("aria-selected")).toBe("true");
  });

  it("adding an unapplied label calls addIssueLabelAction immediately, applied optimistically before the server answers", async () => {
    const updateIssueAction = vi.fn<(input: UpdateIssuePayload) => Promise<UpdateIssueResult>>();
    let resolveAdd: (value: IssueLabelResult) => void = () => undefined;
    const addIssueLabelAction = vi.fn<(input: IssueLabelPayload) => Promise<IssueLabelResult>>(
      () =>
        new Promise<IssueLabelResult>((resolve) => {
          resolveAdd = resolve;
        }),
    );
    const removeIssueLabelAction = vi.fn<(input: IssueLabelPayload) => Promise<IssueLabelResult>>();
    renderRail(updateIssueAction, { addIssueLabelAction, removeIssueLabelAction });

    fireEvent.click(screen.getByRole("option", { name: "Bug" }));

    await waitFor(() =>
      expect(screen.getByRole("option", { name: "Bug" }).getAttribute("aria-selected")).toBe("true"),
    );
    expect(addIssueLabelAction).toHaveBeenCalledWith({ issueId: "issue-1", labelId: "label-1" });
    expect(removeIssueLabelAction).not.toHaveBeenCalled();

    resolveAdd({ ok: true, applied: true });
  });

  it("removing an applied label calls removeIssueLabelAction immediately", async () => {
    const updateIssueAction = vi.fn<(input: UpdateIssuePayload) => Promise<UpdateIssueResult>>();
    const addIssueLabelAction = vi.fn<(input: IssueLabelPayload) => Promise<IssueLabelResult>>();
    const removeIssueLabelAction = vi
      .fn<(input: IssueLabelPayload) => Promise<IssueLabelResult>>()
      .mockResolvedValue({ ok: true, applied: false });
    renderRail(updateIssueAction, { addIssueLabelAction, removeIssueLabelAction });

    fireEvent.click(screen.getByRole("option", { name: "Urgent" }));

    await waitFor(() =>
      expect(removeIssueLabelAction).toHaveBeenCalledWith({ issueId: "issue-1", labelId: "label-2" }),
    );
    expect(addIssueLabelAction).not.toHaveBeenCalled();
  });

  it("rolls back the optimistic apply and shows a toast on refusal", async () => {
    const updateIssueAction = vi.fn<(input: UpdateIssuePayload) => Promise<UpdateIssueResult>>();
    const addIssueLabelAction = vi
      .fn<(input: IssueLabelPayload) => Promise<IssueLabelResult>>()
      .mockResolvedValue({ ok: false, error: "label_not_found" });
    const removeIssueLabelAction = vi.fn<(input: IssueLabelPayload) => Promise<IssueLabelResult>>();
    renderRail(updateIssueAction, { addIssueLabelAction, removeIssueLabelAction });

    fireEvent.click(screen.getByRole("option", { name: "Bug" }));

    await waitFor(() => expect(addIssueLabelAction).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByRole("option", { name: "Bug" }).getAttribute("aria-selected")).toBe("false"),
    );
    expect(showToastMock).toHaveBeenCalledTimes(1);
    expect(showToastMock).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "error", message: expect.any(String) }),
    );
  });

  it("renders disabled with the rail's own reason for a non-member, calling no mutator", () => {
    const updateIssueAction = vi.fn<(input: UpdateIssuePayload) => Promise<UpdateIssueResult>>();
    const addIssueLabelAction = vi.fn<(input: IssueLabelPayload) => Promise<IssueLabelResult>>();
    const removeIssueLabelAction = vi.fn<(input: IssueLabelPayload) => Promise<IssueLabelResult>>();
    renderRail(updateIssueAction, {
      canWrite: false,
      writeReason: "Only project members can edit issues in Website Redesign.",
      addIssueLabelAction,
      removeIssueLabelAction,
    });

    expect(
      screen.getAllByText("Only project members can edit issues in Website Redesign.").length,
    ).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("option", { name: "Bug" }));

    expect(addIssueLabelAction).not.toHaveBeenCalled();
    expect(removeIssueLabelAction).not.toHaveBeenCalled();
  });
});