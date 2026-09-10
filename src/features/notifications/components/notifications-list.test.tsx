import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../server/notification-queries", () => ({
  listNotifications: vi.fn(),
}));

import type { NotificationListItem } from "../server/notification-queries";
import { listNotifications } from "../server/notification-queries";
import { NotificationsList } from "./notifications-list";

afterEach(() => {
  vi.clearAllMocks();
});

function item(overrides: Partial<NotificationListItem> = {}): NotificationListItem {
  return {
    id: "n1",
    type: "mention",
    actorName: "Alan Turing",
    actorAvatarUrl: null,
    targetLabel: "WEB-142 · Fix the header",
    href: "/projects/WEB/issues/142/details",
    isUnread: true,
    createdAt: new Date(Date.now() - 60 * 60 * 1000),
    ...overrides,
  };
}

async function renderList(items: NotificationListItem[]) {
  vi.mocked(listNotifications).mockResolvedValue(items);
  return render(await NotificationsList({ userId: "u1" }));
}

describe("NotificationsList (FR-011, FR-022)", () => {
  it("renders one list item per notification, in the order the query returned", async () => {
    await renderList([
      item({ id: "n1", targetLabel: "WEB-3 · Newest" }),
      item({ id: "n2", targetLabel: "WEB-2 · Middle" }),
      item({ id: "n3", targetLabel: "WEB-1 · Oldest" }),
    ]);

    const rows = screen.getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("WEB-3 · Newest") as unknown as string,
      expect.stringContaining("WEB-2 · Middle") as unknown as string,
      expect.stringContaining("WEB-1 · Oldest") as unknown as string,
    ]);
  });

  it("reads the caller's own rows through listNotifications and nobody else's", async () => {
    await renderList([]);

    expect(listNotifications).toHaveBeenCalledWith("u1");
  });
});

describe("NotificationsList empty state (FR-016)", () => {
  it("renders one quiet line reading exactly 'No notifications yet.'", async () => {
    await renderList([]);

    const line = screen.getByText("No notifications yet.");
    expect(line.textContent).toBe("No notifications yet.");
  });

  it("renders no list, no illustration and no empty-state marketing", async () => {
    const { container } = await renderList([]);

    expect(screen.queryByRole("list")).toBeNull();
    expect(container.querySelectorAll("img")).toHaveLength(0);
    expect(container.querySelectorAll("svg")).toHaveLength(0);
    expect(container.querySelectorAll("button")).toHaveLength(0);
  });

  it("drops the quiet line as soon as there is a row", async () => {
    await renderList([item()]);

    expect(screen.queryByText("No notifications yet.")).toBeNull();
    expect(screen.getByRole("list")).not.toBeNull();
  });
});