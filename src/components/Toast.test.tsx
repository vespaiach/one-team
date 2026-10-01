import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider, useToast } from "./Toast.tsx";

const failed = "Couldn't save. Try again.";
const forbidden = "You don't have permission to do that.";

function Consumer() {
  const { showToast } = useToast();
  return (
    <>
      <button type="button" onClick={() => showToast(failed)}>
        Raise failed
      </button>
      <button type="button" onClick={() => showToast(forbidden)}>
        Raise forbidden
      </button>
    </>
  );
}

function renderHost() {
  render(
    <ToastProvider>
      <Consumer />
    </ToastProvider>,
  );
}

function region() {
  const live = document.querySelectorAll('[aria-live="polite"]');
  expect(live).toHaveLength(1);
  return live[0] as HTMLElement;
}

function toastElement(text: string) {
  return screen.getByText(text);
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("ToastProvider and useToast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders one polite live region before any toast", () => {
    renderHost();
    expect(region().textContent).toBe("");
  });

  it("stacks toasts in order of appearance in one polite live region and keeps focus where it was", async () => {
    renderHost();
    const raiseFailed = screen.getByRole("button", { name: "Raise failed" });
    const raiseForbidden = screen.getByRole("button", { name: "Raise forbidden" });

    raiseFailed.focus();
    fireEvent.click(raiseFailed);
    await advance(0);
    expect(document.activeElement).toBe(raiseFailed);

    raiseForbidden.focus();
    fireEvent.click(raiseForbidden);
    await advance(0);
    expect(document.activeElement).toBe(raiseForbidden);

    const live = region();
    expect(live.contains(toastElement(failed))).toBe(true);
    expect(live.contains(toastElement(forbidden))).toBe(true);
    const text = live.textContent ?? "";
    expect(text.indexOf(failed)).toBeGreaterThanOrEqual(0);
    expect(text.indexOf(failed)).toBeLessThan(text.indexOf(forbidden));
  });

  it("removes each toast 5 s after it appeared", async () => {
    renderHost();
    const raiseFailed = screen.getByRole("button", { name: "Raise failed" });
    const raiseForbidden = screen.getByRole("button", { name: "Raise forbidden" });

    raiseFailed.focus();
    fireEvent.click(raiseFailed);
    await advance(1000);
    fireEvent.click(raiseForbidden);
    await advance(0);
    expect(screen.queryByText(failed)).not.toBeNull();
    expect(screen.queryByText(forbidden)).not.toBeNull();

    await advance(3999);
    expect(screen.queryByText(failed)).not.toBeNull();
    expect(screen.queryByText(forbidden)).not.toBeNull();

    await advance(1);
    expect(screen.queryByText(failed)).toBeNull();
    expect(screen.queryByText(forbidden)).not.toBeNull();

    await advance(999);
    expect(screen.queryByText(forbidden)).not.toBeNull();

    await advance(1);
    expect(screen.queryByText(forbidden)).toBeNull();
    expect(region().textContent).toBe("");
    expect(document.activeElement).toBe(raiseFailed);
  });

  it("has no button inside a toast", async () => {
    renderHost();
    fireEvent.click(screen.getByRole("button", { name: "Raise failed" }));
    fireEvent.click(screen.getByRole("button", { name: "Raise forbidden" }));
    await advance(0);
    expect(region().querySelectorAll("button")).toHaveLength(0);
  });

  it("wraps toast text instead of truncating it", async () => {
    renderHost();
    fireEvent.click(screen.getByRole("button", { name: "Raise failed" }));
    fireEvent.click(screen.getByRole("button", { name: "Raise forbidden" }));
    await advance(0);
    for (const text of [failed, forbidden]) {
      const style = getComputedStyle(toastElement(text));
      expect(style.overflowWrap).toBe("anywhere");
      expect(style.whiteSpace).not.toBe("nowrap");
      expect(style.textOverflow).not.toBe("ellipsis");
    }
  });
});
