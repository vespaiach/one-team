import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Loading } from "./Loading.tsx";

describe("Loading", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing at 300 ms", () => {
    const { container } = render(<Loading />);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.queryByRole("status")).toBeNull();
    expect(container.innerHTML).toBe("");
  });

  it("shows a status element named Loading at 301 ms", () => {
    render(<Loading />);
    act(() => {
      vi.advanceTimersByTime(301);
    });
    const status = screen.getByRole("status");
    expect(status.tagName).toBe("DIV");
    expect(status.getAttribute("aria-label")).toBe("Loading");
  });

  it("never renders when unmounted at or before 300 ms", () => {
    const { container, unmount } = render(<Loading />);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(container.innerHTML).toBe("");
    unmount();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.queryByRole("status")).toBeNull();
    expect(container.innerHTML).toBe("");
  });
});