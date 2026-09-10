import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/notifications/server/notification-queries", () => ({
  listRecentMentions: vi.fn(),
}));

import type { NotificationListItem } from "@/features/notifications/server/notification-queries";
import { listRecentMentions } from "@/features/notifications/server/notification-queries";
import { MentionsSection } from "./mentions-section";

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

afterEach(() => {
  vi.clearAllMocks();
});

function item(index: number): NotificationListItem {
  return {
    id: `n${index}`,
    type: "mention",
    actorName: "Alan Turing",
    actorAvatarUrl: null,
    targetLabel: `WEB-${index} · Fix the header`,
    href: `/projects/WEB/issues/${index}/details#comment-c${index}`,
    isUnread: index % 2 === 0,
    createdAt: new Date(Date.now() - TWO_HOURS_MS),
  };
}

function mentions(count: number): NotificationListItem[] {
  return Array.from({ length: count }, (_, index) => item(index));
}

describe("MentionsSection (FR-021, FR-040, SC-005, SC-010)", () => {
  it("is a labelled region with its own heading", async () => {
    vi.mocked(listRecentMentions).mockResolvedValue(mentions(5));

    render(await MentionsSection({ userId: "u1" }));

    expect(screen.getByRole("heading", { name: "Mentions" })).not.toBeNull();
    expect(screen.getByRole("region", { name: "Mentions" })).not.toBeNull();
  });

  it("asks for five rows and renders one row each", async () => {
    vi.mocked(listRecentMentions).mockResolvedValue(mentions(5));

    render(await MentionsSection({ userId: "u1" }));

    expect(listRecentMentions).toHaveBeenCalledWith("u1", 5);
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    expect(screen.getAllByRole("link")).toHaveLength(5);
  });

  it("renders exactly one quiet line and no list when there are no mentions", async () => {
    vi.mocked(listRecentMentions).mockResolvedValue([]);

    const { container } = render(await MentionsSection({ userId: "u1" }));

    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    expect(container.querySelectorAll("p")).toHaveLength(1);
    expect(container.querySelector("p")?.textContent).toBe("No one has mentioned you yet.");
    expect(screen.queryByRole("button")).toBeNull();
  });
});