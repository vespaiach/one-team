import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/notifications/server/notification-queries", () => ({
  countUnreadNotifications: vi.fn(),
}));
vi.mock("../server/assigned-queries", () => ({
  listAssignedIssues: vi.fn(),
}));

import { countUnreadNotifications } from "@/features/notifications/server/notification-queries";
import { listAssignedIssues } from "../server/assigned-queries";
import { StatCards } from "./stat-cards";
import { StatCardsSkeleton } from "./stat-cards-skeleton";

afterEach(() => {
  vi.clearAllMocks();
});

describe("StatCardsSkeleton (FR-038, SC-011)", () => {
  it("marks itself busy for assistive technology and renders no spinner", () => {
    const { container } = render(<StatCardsSkeleton />);

    expect(container.querySelector("[aria-busy='true']")).not.toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("renders card-shaped pulse blocks in the repo's established form", () => {
    const { container } = render(<StatCardsSkeleton />);

    const blocks = container.querySelectorAll(".animate-pulse");
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) {
      expect(block.className).toContain("bg-(--color-divider)");
    }
  });

  it("reserves the loaded cards' own geometry — three cards in the same row", async () => {
    vi.mocked(listAssignedIssues).mockResolvedValue([]);
    vi.mocked(countUnreadNotifications).mockResolvedValue(0);

    const { container: skeleton } = render(<StatCardsSkeleton />);
    const { container: loaded } = render(await StatCards({ userId: "u1" }));

    expect(skeleton.querySelectorAll("li")).toHaveLength(3);
    expect(skeleton.querySelectorAll("li")).toHaveLength(loaded.querySelectorAll("li").length);
    expect(skeleton.querySelector("ul")?.className).toBe(loaded.querySelector("ul")?.className);
    expect(skeleton.querySelector("li")?.className).toBe(loaded.querySelector("li")?.className);
  });
});