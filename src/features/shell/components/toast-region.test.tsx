import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { showToast, TOAST_TIMEOUT_MS, ToastRegion, toastQueue } from "./toast-region";

beforeEach(() => {
  toastQueue.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ToastRegion (FR-054, R2 FR-034)", () => {
  it("renders top-right, stacking new toasts nearest the corner via source order", () => {
    render(<ToastRegion />);
    act(() => {
      showToast({ kind: "success", message: "Positioned toast" });
    });

    const region = screen.getByRole("region", { name: /notifications/i });
    expect(region.className).toContain("top-");
    expect(region.className).toContain("right-");
    expect(region.className).toContain("flex-col");
    expect(region.className).not.toContain("flex-col-reverse");
  });

  it("carries each of the four toast kinds", () => {
    render(<ToastRegion />);

    act(() => {
      showToast({ kind: "success", message: "Invitation sent" });
      showToast({ kind: "info", message: "For your information" });
      showToast({ kind: "warning", message: "Mail did not go" });
      showToast({ kind: "error", message: "Something failed" });
    });

    expect(screen.getByText("Invitation sent")).not.toBeNull();
    expect(screen.getByText("For your information")).not.toBeNull();
    expect(screen.getByText("Mail did not go")).not.toBeNull();
    expect(screen.getByText("Something failed")).not.toBeNull();
  });

  it("renders the newest toast first, so it lands nearest the corner", () => {
    render(<ToastRegion />);

    act(() => {
      showToast({ kind: "success", message: "First toast" });
      showToast({ kind: "success", message: "Second toast" });
    });

    const messages = screen.getAllByText(/toast$/).map((el) => el.textContent);
    expect(messages).toEqual(["Second toast", "First toast"]);
  });

  it("auto-dismisses a toast five seconds after it appears", () => {
    vi.useFakeTimers();
    render(<ToastRegion />);

    act(() => {
      showToast({ kind: "success", message: "Auto dismiss me" });
    });
    expect(screen.getByText("Auto dismiss me")).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(TOAST_TIMEOUT_MS - 1);
    });
    expect(screen.getByText("Auto dismiss me")).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByText("Auto dismiss me")).toBeNull();
  });

  it("gives every toast a dismiss control that removes it", async () => {
    render(<ToastRegion />);

    act(() => {
      showToast({ kind: "success", message: "Dismiss me by hand" });
    });

    const dismiss = screen.getByRole("button", { name: /dismiss/i });
    act(() => {
      dismiss.click();
    });

    expect(screen.queryByText("Dismiss me by hand")).toBeNull();
  });

  it("styles the error and warning kinds with the semantic danger/advisory tokens, not Tailwind's default palette", () => {
    render(<ToastRegion />);

    act(() => {
      showToast({ kind: "warning", message: "Mail did not go" });
      showToast({ kind: "error", message: "Something failed" });
    });

    const toasts = screen.getAllByRole("alertdialog");
    const warningToast = toasts.find((toast) => toast.textContent?.includes("Mail did not go"));
    const errorToast = toasts.find((toast) => toast.textContent?.includes("Something failed"));

    expect(warningToast?.className).toContain("--color-advisory");
    expect(warningToast?.className).toContain("--color-advisory-fill");
    expect(warningToast?.className).not.toMatch(/amber-/);

    expect(errorToast?.className).toContain("--color-danger");
    expect(errorToast?.className).toContain("--color-danger-fill");
    expect(errorToast?.className).not.toMatch(/red-/);
  });
});