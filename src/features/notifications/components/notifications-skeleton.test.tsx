import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../server/notification-queries", () => ({
  listNotifications: vi.fn(),
}));

import type { NotificationListItem } from "../server/notification-queries";
import { listNotifications } from "../server/notification-queries";
import { NotificationsList } from "./notifications-list";
import { NotificationsSkeleton } from "./notifications-skeleton";

afterEach(() => {
  vi.clearAllMocks();
});

function item(index: number): NotificationListItem {
  return {
    id: `n${index}`,
    type: "mention",
    actorName: "Alan Turing",
    targetLabel: `WEB-${index} · Fix the header`,
    href: `/projects/WEB/issues/${index}/details`,
    isUnread: true,
    createdAt: new Date(Date.now() - 60 * 60 * 1000),
  };
}

describe("NotificationsSkeleton (FR-017)", () => {
  it("renders row-shaped pulse blocks in the repo's established form", () => {
    const { container } = render(<NotificationsSkeleton />);

    const blocks = container.querySelectorAll(".animate-pulse");
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) {
      expect(block.className).toContain("bg-(--color-divider)");
    }
  });

  it("marks itself busy for assistive technology and is never a full-screen spinner", () => {
    const { container } = render(<NotificationsSkeleton />);

    expect(container.querySelector("[aria-busy='true']")).not.toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("renders more than one placeholder row", () => {
    const { container } = render(<NotificationsSkeleton />);

    expect(container.querySelectorAll("li").length).toBeGreaterThan(1);
  });

  it("renders the same list shape the loaded list renders, so nothing shifts when the data lands", async () => {
    const { container: skeletonContainer } = render(<NotificationsSkeleton />);
    const placeholderRowCount = skeletonContainer.querySelectorAll("li").length;

    vi.mocked(listNotifications).mockResolvedValue(
      Array.from({ length: placeholderRowCount }, (_, index) => item(index)),
    );
    const { container: listContainer } = render(await NotificationsList({ userId: "u1" }));

    expect(skeletonContainer.querySelectorAll("ul")).toHaveLength(
      listContainer.querySelectorAll("ul").length,
    );
    expect(skeletonContainer.querySelectorAll("li")).toHaveLength(
      listContainer.querySelectorAll("li").length,
    );
  });
});