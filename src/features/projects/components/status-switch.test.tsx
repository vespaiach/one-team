import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StatusSwitch } from "./status-switch";

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

describe("StatusSwitch (FR-041, FR-042, FR-043)", () => {
  it("shows an active project as unselected and enabled for an admin", () => {
    render(
      <StatusSwitch
        status="active"
        onSave={vi.fn().mockResolvedValue({ status: "saved" })}
      />,
    );

    const control = screen.getByRole("switch") as HTMLInputElement;
    expect(control.hasAttribute("disabled")).toBe(false);
    expect(control.checked).toBe(false);
  });

  it("shows an archived project as selected", () => {
    render(
      <StatusSwitch
        status="archived"
        onSave={vi.fn().mockResolvedValue({ status: "saved" })}
      />,
    );

    const control = screen.getByRole("switch") as HTMLInputElement;
    expect(control.checked).toBe(true);
  });

  it("disables the switch with an inline reason for a non-admin", () => {
    render(
      <StatusSwitch
        status="active"
        isDisabled
        disabledReason="Only admins can archive a project."
        onSave={vi.fn()}
      />,
    );

    const control = screen.getByRole("switch");
    expect(control.hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("Only admins can archive a project.")).not.toBeNull();
  });

  it("applies the flip optimistically and calls onSave with the opposite status", async () => {
    const onSave = vi.fn().mockResolvedValue({ status: "saved" });
    render(
      <StatusSwitch
        status="active"
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole("switch"));

    expect((screen.getByRole("switch") as HTMLInputElement).checked).toBe(true);
    await waitFor(() => expect(onSave).toHaveBeenCalledWith("archived"));
  });

  it("rolls back to the previous status and shows a message when the server refuses", async () => {
    const onSave = vi.fn().mockResolvedValue({ status: "forbidden" });
    render(
      <StatusSwitch
        status="active"
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole("switch"));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    await waitFor(() => expect((screen.getByRole("switch") as HTMLInputElement).checked).toBe(false));
    expect(showToastMock).toHaveBeenCalledWith({
      kind: "error",
      message: expect.stringContaining("status") as string,
    });
  });
});