import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/notifications/server/notification-queries", () => ({
  countUnreadNotifications: vi.fn(),
}));
vi.mock("../server/assigned-queries", () => ({
  listAssignedIssues: vi.fn(),
}));

import { countUnreadNotifications } from "@/features/notifications/server/notification-queries";
import type { AssignedIssueRow } from "../server/assigned-queries";
import { listAssignedIssues } from "../server/assigned-queries";
import { StatCards } from "./stat-cards";

afterEach(() => {
  vi.clearAllMocks();
});

function assignedRow(index: number, dueThisWeek: boolean): AssignedIssueRow {
  return {
    id: `i${index}`,
    key: `WEB-${index}`,
    title: `Issue ${index}`,
    projectName: "Website Redesign",
    href: `/projects/WEB/issues/${index}/details`,
    dueThisWeek,
  };
}

function seed(rows: AssignedIssueRow[], unread: number) {
  vi.mocked(listAssignedIssues).mockResolvedValue(rows);
  vi.mocked(countUnreadNotifications).mockResolvedValue(unread);
}

describe("StatCards (FR-006, OT-UX-018)", () => {
  it("renders three cards in the order assigned to you, due this week, unread", async () => {
    seed([assignedRow(1, true), assignedRow(2, false)], 4);

    const { container } = render(await StatCards({ userId: "u1" }));
    const labels = Array.from(container.querySelectorAll("li")).map((card) =>
      (card.textContent ?? "").toLowerCase(),
    );

    expect(labels).toHaveLength(3);
    expect(labels[0]).toContain("assigned to you");
    expect(labels[1]).toContain("due this week");
    expect(labels[2]).toContain("unread");
  });

  it("gives every number a text label naming what it counts, so no number is carried by size, colour or position alone", async () => {
    seed([assignedRow(1, true), assignedRow(2, false)], 4);

    const { container } = render(await StatCards({ userId: "u1" }));
    const cards = Array.from(container.querySelectorAll("li"));

    for (const [index, label] of ["Assigned to you", "Due this week", "Unread"].entries()) {
      const card = cards[index];
      expect(card?.textContent).toContain(label);
      expect((card?.textContent ?? "").replace(label, "")).toMatch(/\d/);
    }
  });
});

describe("StatCards reads the assigned list once, so a card cannot disagree with its section (FR-007, SC-002)", () => {
  it("derives both the assigned number and the due-this-week number from one listAssignedIssues result", async () => {
    seed(
      [
        assignedRow(1, true),
        assignedRow(2, false),
        assignedRow(3, true),
        assignedRow(4, true),
        assignedRow(5, false),
      ],
      0,
    );

    const { container } = render(await StatCards({ userId: "u1" }));
    const cards = Array.from(container.querySelectorAll("li"));

    expect(listAssignedIssues).toHaveBeenCalledTimes(1);
    expect(listAssignedIssues).toHaveBeenCalledWith("u1");
    expect(cards[0]?.textContent).toContain("5");
    expect(cards[1]?.textContent).toContain("3");
  });
});

describe("StatCards unread card follows the sidebar's unbounded count (FR-009, SC-003)", () => {
  it("renders the count countUnreadNotifications returns even beyond the 200-row notifications list", async () => {
    seed([], 237);

    const { container } = render(await StatCards({ userId: "u1" }));

    expect(countUnreadNotifications).toHaveBeenCalledWith("u1");
    expect(container.querySelectorAll("li")[2]?.textContent).toContain("237");
  });
});

describe("StatCards renders a zero, never an empty state (FR-040, US1 s6)", () => {
  it("renders the digit 0 in each card when the viewer has nothing", async () => {
    seed([], 0);

    render(await StatCards({ userId: "u1" }));

    expect(screen.getAllByText("0")).toHaveLength(3);
  });
});