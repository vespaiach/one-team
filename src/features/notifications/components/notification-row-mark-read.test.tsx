import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NotificationListItem } from "../server/notification-queries";

const { markNotificationReadMock } = vi.hoisted(() => ({ markNotificationReadMock: vi.fn() }));

vi.mock("../actions", () => ({ markNotificationRead: markNotificationReadMock }));

vi.mock("next/link", () => ({
  default: ({
    href,
    onNavigate,
    children,
    ...rest
  }: {
    href: string;
    onNavigate?: () => void;
    children: ReactNode;
  }) => (
    <a
      href={href}
      onClick={() => {
        onNavigate?.();
      }}
      {...rest}>
      {children}
    </a>
  ),
}));

const ROW_SOURCE = readFileSync(
  join(process.cwd(), "src/features/notifications/components/notification-row.tsx"),
  "utf8",
);

function item(overrides: Partial<NotificationListItem> = {}): NotificationListItem {
  return {
    id: "n1",
    type: "mention",
    actorName: "Alan Turing",
    actorAvatarUrl: null,
    targetLabel: "WEB-142 · Fix the header",
    href: "/projects/WEB/issues/142/details#comment-c1",
    isUnread: true,
    createdAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  markNotificationReadMock.mockReset();
  markNotificationReadMock.mockResolvedValue({ status: "ok" });
});

describe("NotificationRow activation marks read (FR-025, SC-017)", () => {
  it("fires markNotificationRead for its own id when the row is activated", async () => {
    const { NotificationRow } = await import("./notification-row");
    render(<NotificationRow item={item({ id: "n-42" })} />);

    fireEvent.click(screen.getByRole("link"));

    await waitFor(() => expect(markNotificationReadMock).toHaveBeenCalledWith({ notificationId: "n-42" }));
  });

  it("does not await the write, so the navigation is not held behind it", async () => {
    markNotificationReadMock.mockImplementation(() => new Promise(() => undefined));
    const { NotificationRow } = await import("./notification-row");
    render(<NotificationRow item={item()} />);

    const link = screen.getByRole("link");
    const activated = fireEvent.click(link);

    expect(activated).toBe(true);
    expect(markNotificationReadMock).toHaveBeenCalledTimes(1);
  });

  it("swallows a rejected write, leaving the row unread and raising nothing", async () => {
    markNotificationReadMock.mockRejectedValue(new Error("connection lost"));
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    const { NotificationRow } = await import("./notification-row");
    render(<NotificationRow item={item()} />);

    fireEvent.click(screen.getByRole("link"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    process.off("unhandledRejection", unhandled);

    expect(markNotificationReadMock).toHaveBeenCalledTimes(1);
    expect(unhandled).not.toHaveBeenCalled();
    expect(screen.getByText("Unread")).not.toBeNull();
  });

  it("never imports showToast, so a failed write raises no toast", () => {
    expect(ROW_SOURCE).not.toContain("showToast");
  });
});