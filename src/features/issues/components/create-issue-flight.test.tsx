import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CreateIssueState } from "../actions";
import type { AssigneeOption, IssueColumnOption } from "../server/issue-queries";
import { CreateIssueForm } from "./create-issue-form";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const columns: IssueColumnOption[] = [{ id: "col-1", name: "Backlog" }];
const assigneePool: AssigneeOption[] = [];

type CreateIssueActionMock = (prevState: CreateIssueState, formData: FormData) => Promise<CreateIssueState>;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeEach(() => {
  pushMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderForm(action: CreateIssueActionMock) {
  return render(
    <CreateIssueForm
      projectId="project-1"
      projectKey="WEB"
      columns={columns}
      assigneePool={assigneePool}
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

describe("CreateIssueForm — in-flight and cancel (FR-015, FR-038, FR-039, US1 s5, s6)", () => {
  it("shows in-flight state on the Create control while the request is pending", async () => {
    const { promise, resolve } = deferred<CreateIssueState>();
    const action = vi.fn().mockReturnValue(promise);
    renderForm(action);

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Fix the header" } });
    submit();

    await screen.findByText(/creating/i);

    resolve({ status: "idle" });
  });

  it("the form waits and issues no navigation while the request is pending", () => {
    const { promise } = deferred<CreateIssueState>();
    const action = vi.fn().mockReturnValue(promise);
    renderForm(action);

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Fix the header" } });
    submit();

    expect(pushMock).not.toHaveBeenCalled();
  });

  it("renders no issue key anywhere, not even a placeholder, before or during submission", async () => {
    const { promise, resolve } = deferred<CreateIssueState>();
    const action = vi.fn().mockReturnValue(promise);
    const { container } = renderForm(action);

    expect(container.textContent).not.toMatch(/WEB-\d/);
    expect(container.textContent).not.toMatch(/WEB-\?/);

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Fix the header" } });
    submit();

    await screen.findByText(/creating/i);
    expect(container.textContent).not.toMatch(/WEB-\d/);
    expect(container.textContent).not.toMatch(/WEB-\?/);

    resolve({ status: "idle" });
  });

  it("Cancel writes nothing and navigates to the project's details page", () => {
    const action = vi.fn();
    renderForm(action);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(action).not.toHaveBeenCalled();
    expect(pushMock).toHaveBeenCalledWith("/projects/WEB/details");
  });
});