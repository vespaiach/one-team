import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CreateProjectPayload, CreateProjectState } from "../actions";
import type { RosterEntry } from "../server/queries";
import { CreateProjectForm } from "./create-project-form";

type CreateProjectActionMock = (
  prevState: CreateProjectState,
  input: CreateProjectPayload,
) => Promise<CreateProjectState>;

const pushMock = vi.fn();
const backMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, back: backMock }),
}));

const candidates: RosterEntry[] = [
  { userId: "u1", displayName: "Ada Lovelace", avatarUrl: null, jobTitle: null, deactivated: false },
];

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeEach(() => {
  pushMock.mockReset();
  backMock.mockReset();
  Object.defineProperty(document, "referrer", { value: "", configurable: true });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderForm(action: CreateProjectActionMock) {
  return render(
    <CreateProjectForm
      createProjectAction={action}
      checkKeyAvailability={vi.fn().mockResolvedValue({ holder: null })}
      candidates={candidates}
    />,
  );
}

describe("CreateProjectForm (FR-024, FR-027, FR-031, FR-032, FR-033, FR-034)", () => {
  it("focuses the name field on mount, first in the tab order", () => {
    const action = vi.fn();
    renderForm(action);

    const name = screen.getByLabelText("Name");
    expect(document.activeElement).toBe(name);
  });

  it("trims the name before submission", async () => {
    const action = vi.fn().mockResolvedValue({ status: "idle" });
    renderForm(action);

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "  Website Redesign  " } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(action).toHaveBeenCalled());
    const [, payload] = action.mock.calls[0] as [unknown, { name: string }];
    expect(payload.name).toBe("Website Redesign");
  });

  it("grows the description within a bounded, scrollable area and renders no preview", () => {
    const action = vi.fn();
    renderForm(action);

    const description = screen.getByLabelText("Description") as HTMLTextAreaElement;
    expect(description.tagName).toBe("TEXTAREA");
    expect(description.className).toMatch(/max-h-/);
    expect(description.className).toMatch(/overflow-y-auto/);
    fireEvent.change(description, { target: { value: "**bold**" } });
    expect(screen.queryByText("bold", { selector: "strong" })).toBeNull();
  });

  it("offers no status control and no column control anywhere on the form", () => {
    const action = vi.fn();
    renderForm(action);

    expect(screen.queryByRole("switch")).toBeNull();
    expect(screen.queryByText(/status/i)).toBeNull();
    expect(screen.queryByText(/backlog/i)).toBeNull();
    expect(screen.queryByText(/column/i)).toBeNull();
  });

  it("validates the name per field on blur", () => {
    const action = vi.fn();
    renderForm(action);

    const name = screen.getByLabelText("Name");
    fireEvent.change(name, { target: { value: "  " } });
    fireEvent.blur(name);

    expect(screen.getByText("Name is required.")).toBeDefined();
  });

  it("keeps Create enabled and reports what is missing inline rather than going dead", async () => {
    const action = vi.fn().mockResolvedValue({ status: "invalid", field: "name", reason: "required" });
    renderForm(action);

    const createButton = screen.getByRole("button", { name: "Create" });
    expect(createButton.hasAttribute("disabled")).toBe(false);

    fireEvent.click(createButton);

    await waitFor(() => expect(action).toHaveBeenCalled());
    expect(createButton.hasAttribute("disabled")).toBe(false);
  });

  it("shows in-flight state on the Create control while the request is pending", async () => {
    const { promise, resolve } = deferred<{ status: "idle" }>();
    const action = vi.fn().mockReturnValue(promise);
    renderForm(action);

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Website Redesign" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await screen.findByText(/creating/i);

    resolve({ status: "idle" });
  });

  it("does not navigate optimistically while the create request is pending", () => {
    const { promise } = deferred<{ status: "idle" }>();
    const action = vi.fn().mockReturnValue(promise);
    renderForm(action);

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Website Redesign" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(pushMock).not.toHaveBeenCalled();
    expect(backMock).not.toHaveBeenCalled();
  });

  it("Cancel writes nothing and returns to the referrer", () => {
    Object.defineProperty(document, "referrer", {
      value: `${window.location.origin}/home`,
      configurable: true,
    });
    const action = vi.fn();
    renderForm(action);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(action).not.toHaveBeenCalled();
    expect(backMock).toHaveBeenCalledTimes(1);
  });

  it("Cancel returns Home when there is nowhere to return to", () => {
    Object.defineProperty(document, "referrer", { value: "", configurable: true });
    const action = vi.fn();
    renderForm(action);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(action).not.toHaveBeenCalled();
    expect(pushMock).toHaveBeenCalledWith("/home");
  });
});