import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/notifications/server/notification-queries", () => ({
  listRecentMentions: vi.fn(),
}));

import type { NotificationListItem } from "@/features/notifications/server/notification-queries";
import { listRecentMentions } from "@/features/notifications/server/notification-queries";
import { MentionsSection } from "./mentions-section";
import { MentionsSkeleton } from "./mentions-skeleton";

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

afterEach(() => {
  vi.clearAllMocks();
});

function item(index: number): NotificationListItem {
  return {
    id: `n${index}`,
    type: "mention",
    actorName: "Alan Turing",
    targetLabel: `WEB-${index} · Fix the header`,
    href: `/projects/WEB/issues/${index}/details#comment-c${index}`,
    isUnread: true,
    createdAt: new Date(Date.now() - TWO_HOURS_MS),
  };
}

function boxGeometry(element: Element): string[] {
  return element.className
    .split(" ")
    .filter((token) => /^(px-|py-|gap-|text-(control|label)$)/.test(token))
    .sort();
}

describe("MentionsSkeleton (FR-038, SC-011, screens §2)", () => {
  it("reserves exactly the five placeholder rows §3.2 bounds Mentions at", () => {
    const { container } = render(<MentionsSkeleton />);

    expect(container.querySelectorAll("li")).toHaveLength(5);
  });

  it("marks itself busy for assistive technology and is never a spinner", () => {
    const { container } = render(<MentionsSkeleton />);

    expect(container.querySelector("[aria-busy='true']")).not.toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("renders pulse blocks in the repo's established form", () => {
    const { container } = render(<MentionsSkeleton />);

    const blocks = container.querySelectorAll(".animate-pulse");
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) {
      expect(block.className).toContain("bg-(--color-divider)");
    }
  });

  it("matches the loaded section's frame, heading and per-row geometry for a five-row load", async () => {
    const { container: skeleton } = render(<MentionsSkeleton />);

    vi.mocked(listRecentMentions).mockResolvedValue([1, 2, 3, 4, 5].map(item));
    const { container: loaded } = render(await MentionsSection({ userId: "u1" }));

    expect(skeleton.querySelectorAll("ul")).toHaveLength(loaded.querySelectorAll("ul").length);
    expect(skeleton.querySelectorAll("li")).toHaveLength(loaded.querySelectorAll("li").length);

    const skeletonHeading = skeleton.querySelector("h2");
    const loadedHeading = loaded.querySelector("h2");
    expect(skeletonHeading?.textContent).toBe(loadedHeading?.textContent);
    expect(skeletonHeading === null ? null : boxGeometry(skeletonHeading)).toEqual(
      loadedHeading === null ? null : boxGeometry(loadedHeading),
    );

    const skeletonRow = skeleton.querySelector("li")?.firstElementChild ?? null;
    const loadedRow = loaded.querySelector("li")?.firstElementChild ?? null;
    expect(skeletonRow === null ? null : boxGeometry(skeletonRow)).toEqual(
      loadedRow === null ? null : boxGeometry(loadedRow),
    );
  });
});