import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeleteProjectControl } from "./delete-project-control";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const showToastMock = vi.fn();
vi.mock("@/features/shell/components/toast-region", () => ({
  showToast: (...args: unknown[]) => showToastMock(...args),
}));

beforeEach(() => {
  pushMock.mockClear();
  showToastMock.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DeleteProjectControl (FR-047, FR-048)", () => {
  it("disables the control with an inline reason on an active project", () => {
    render(
      <DeleteProjectControl
        projectName="Website Redesign"
        cascadeCount={5}
        isDisabled
        disabledReason="Archive Website Redesign before deleting it."
        onDelete={vi.fn()}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Delete" });
    expect(trigger.hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("Archive Website Redesign before deleting it.")).not.toBeNull();
  });

  it("states the size of the cascade in the confirmation before anything is written", async () => {
    const onDelete = vi.fn();
    render(
      <DeleteProjectControl
        projectName="Website Redesign"
        cascadeCount={7}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByText(/7/)).not.toBeNull();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("discards on Escape without calling onDelete", async () => {
    const onDelete = vi.fn();
    render(
      <DeleteProjectControl
        projectName="Website Redesign"
        cascadeCount={7}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await screen.findByRole("dialog");

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("discards on Cancel without calling onDelete", async () => {
    const onDelete = vi.fn();
    render(
      <DeleteProjectControl
        projectName="Website Redesign"
        cascadeCount={7}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("confirms and deletes even when the shown count is stale, treating it as advisory", async () => {
    const onDelete = vi.fn().mockResolvedValue({ status: "deleted" });
    render(
      <DeleteProjectControl
        projectName="Website Redesign"
        cascadeCount={0}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));

    await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1));
  });

  it("navigates to Home on success", async () => {
    const onDelete = vi.fn().mockResolvedValue({ status: "deleted" });
    render(
      <DeleteProjectControl
        projectName="Website Redesign"
        cascadeCount={7}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/home"));
  });

  it("shows a message and keeps the project when the server refuses", async () => {
    const onDelete = vi.fn().mockResolvedValue({ status: "not_archived" });
    render(
      <DeleteProjectControl
        projectName="Website Redesign"
        cascadeCount={7}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));

    await waitFor(() => expect(showToastMock).toHaveBeenCalled());
    expect(pushMock).not.toHaveBeenCalled();
  });
});