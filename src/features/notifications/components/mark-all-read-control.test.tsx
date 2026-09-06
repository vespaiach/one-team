import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { markAllNotificationsReadMock } = vi.hoisted(() => ({
  markAllNotificationsReadMock: vi.fn(),
}));

vi.mock("../actions", () => ({ markAllNotificationsRead: markAllNotificationsReadMock }));

beforeEach(() => {
  markAllNotificationsReadMock.mockReset();
  markAllNotificationsReadMock.mockResolvedValue({ status: "ok" });
});

async function renderControl(unreadCount: number) {
  const { MarkAllReadControl } = await import("./mark-all-read-control");
  render(<MarkAllReadControl unreadCount={unreadCount} />);
  return screen.getByRole("button", { name: /mark all read/i });
}

describe("MarkAllReadControl (FR-020, FR-021, FR-028, FR-074, SC-016)", () => {
  it("renders a focusable button carrying its own accessible name", async () => {
    const button = await renderControl(3);

    button.focus();
    expect(document.activeElement).toBe(button);
  });

  it("carries a visible focus indicator rather than relying on the browser default being removed", async () => {
    const button = await renderControl(3);

    expect(button.getAttribute("class")).toContain("data-[focus-visible]:outline");
  });

  it("calls markAllNotificationsRead exactly once per press", async () => {
    const button = await renderControl(3);

    fireEvent.click(button);

    await waitFor(() => expect(markAllNotificationsReadMock).toHaveBeenCalledTimes(1));
  });

  it("is operable by Enter", async () => {
    const button = await renderControl(3);

    button.focus();
    fireEvent.keyDown(button, { key: "Enter" });
    fireEvent.keyUp(button, { key: "Enter" });

    await waitFor(() => expect(markAllNotificationsReadMock).toHaveBeenCalledTimes(1));
  });

  it("is operable by Space", async () => {
    const button = await renderControl(3);

    button.focus();
    fireEvent.keyDown(button, { key: " " });
    fireEvent.keyUp(button, { key: " " });

    await waitFor(() => expect(markAllNotificationsReadMock).toHaveBeenCalledTimes(1));
  });

  it("renders disabled with its reason inline, never hidden, when there is nothing to clear", async () => {
    const button = await renderControl(0);

    expect(button.hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("Nothing to clear")).not.toBeNull();
  });

  it("writes nothing when it is pressed with nothing to clear", async () => {
    const button = await renderControl(0);

    fireEvent.click(button);

    expect(markAllNotificationsReadMock).not.toHaveBeenCalled();
  });

  it("blocks only itself while the write is in flight", async () => {
    let release: (() => void) | undefined;
    markAllNotificationsReadMock.mockImplementation(
      () =>
        new Promise<{ status: "ok" }>((resolve) => {
          release = () => resolve({ status: "ok" });
        }),
    );
    const button = await renderControl(3);

    fireEvent.click(button);

    await waitFor(() => expect(button.hasAttribute("disabled")).toBe(true));
    fireEvent.click(button);
    expect(markAllNotificationsReadMock).toHaveBeenCalledTimes(1);

    release?.();
    await waitFor(() => expect(button.hasAttribute("disabled")).toBe(false));
  });
});