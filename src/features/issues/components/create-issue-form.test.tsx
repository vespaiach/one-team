import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CreateIssueState } from "../actions";
import type { AssigneeOption, IssueColumnOption } from "../server/issue-queries";
import { CreateIssueForm } from "./create-issue-form";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const columns: IssueColumnOption[] = [
  { id: "col-1", name: "Backlog" },
  { id: "col-2", name: "Todo" },
];

const assigneePool: AssigneeOption[] = [
  { id: "user-1", firstName: "Ada", lastName: "Lovelace", avatarUrl: null, jobTitle: null },
];

type CreateIssueActionMock = (prevState: CreateIssueState, formData: FormData) => Promise<CreateIssueState>;

beforeEach(() => {
  pushMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderForm(action: CreateIssueActionMock, pool: AssigneeOption[] = assigneePool) {
  return render(
    <CreateIssueForm
      projectId="project-1"
      projectKey="WEB"
      columns={columns}
      assigneePool={pool}
      createIssueAction={action}
    />,
  );
}

function submit() {
  const form = screen.getByRole("button", { name: "Create" }).closest("form");
  if (!form) {
    throw new Error("no form found");
  }
  fireEvent.submit(form);
}

describe("CreateIssueForm (FR-030, FR-031, FR-036, FR-037)", () => {
  it("focuses the title field on mount, first in the tab order", () => {
    const action = vi.fn();
    renderForm(action);

    const title = screen.getByLabelText("Title");
    expect(document.activeElement).toBe(title);
  });

  it("renders no project field anywhere", () => {
    const action = vi.fn();
    renderForm(action);

    expect(screen.queryByLabelText(/project/i)).toBeNull();
    expect(screen.queryByText(/^project$/i)).toBeNull();
  });

  it("title is the only required field", () => {
    const action = vi.fn();
    renderForm(action);

    expect(screen.getByLabelText("Title").getAttribute("aria-required")).toBe("true");
    expect(screen.getByLabelText("Description").hasAttribute("aria-required")).toBe(false);
  });

  it("validates the title on blur", () => {
    const action = vi.fn();
    renderForm(action);

    const title = screen.getByLabelText("Title");
    fireEvent.change(title, { target: { value: "   " } });
    fireEvent.blur(title);

    expect(screen.getByText("Title is required.")).toBeDefined();
    expect(action).not.toHaveBeenCalled();
  });

  it("validates every field again on submit even when nothing was blurred", () => {
    const action = vi.fn();
    renderForm(action);

    submit();

    expect(screen.getByText("Title is required.")).toBeDefined();
    expect(action).not.toHaveBeenCalled();
  });

  it("keeps Create enabled while reporting a validation problem inline, never going dead", () => {
    const action = vi.fn();
    renderForm(action);

    submit();

    const createButton = screen.getByRole("button", { name: "Create" });
    expect(createButton.hasAttribute("disabled")).toBe(false);
  });

  it("reports an over-length title on the field naming the bound and issues no save", () => {
    const action = vi.fn();
    renderForm(action);

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "a".repeat(201) } });
    submit();

    expect(screen.getByText(/200 characters or fewer/)).toBeDefined();
    expect(action).not.toHaveBeenCalled();
  });

  it("reports an over-length description on the field naming the bound and issues no save", () => {
    const action = vi.fn();
    renderForm(action);

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Fix the header" } });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "a".repeat(10001) } });
    submit();

    expect(screen.getByText(/10,000 characters or fewer/)).toBeDefined();
    expect(action).not.toHaveBeenCalled();
  });

  it("submits once title is valid and no field is over its bound", async () => {
    const action = vi.fn().mockResolvedValue({ status: "idle" });
    renderForm(action);

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Fix the header" } });
    submit();

    await vi.waitFor(() => expect(action).toHaveBeenCalled());
  });

  it("renders the assignee control offering only Unassigned when the project's pool is empty", () => {
    const action = vi.fn();
    renderForm(action, []);

    const assigneeButton = screen.getByLabelText("Assignee");
    expect(assigneeButton).toBeDefined();
    fireEvent.click(assigneeButton);
    expect(screen.getByRole("option", { name: "Unassigned" })).toBeDefined();
  });
});