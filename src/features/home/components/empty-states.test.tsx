import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../server/assigned-queries", () => ({ listAssignedIssues: vi.fn() }));
vi.mock("../server/project-queries", () => ({ listMemberProjectsWithProgress: vi.fn() }));
vi.mock("../server/activity-queries", () => ({ listInstallationActivity: vi.fn() }));
vi.mock("@/features/notifications/server/notification-queries", () => ({
  countUnreadNotifications: vi.fn(),
  listRecentMentions: vi.fn(),
}));

import {
  countUnreadNotifications,
  listRecentMentions,
} from "@/features/notifications/server/notification-queries";
import { listInstallationActivity } from "../server/activity-queries";
import { listAssignedIssues } from "../server/assigned-queries";
import { listMemberProjectsWithProgress } from "../server/project-queries";
import { ActivitySection } from "./activity-section";
import { AssignedSection } from "./assigned-section";
import { MentionsSection } from "./mentions-section";
import { ProjectsSection } from "./projects-section";
import { StatCards } from "./stat-cards";

const USER_ID = "u1";

const sections = [
  ["Assigned to you", () => AssignedSection({ userId: USER_ID })],
  ["Your projects", () => ProjectsSection({ userId: USER_ID })],
  ["Mentions", () => MentionsSection({ userId: USER_ID })],
  ["Recent activity", () => ActivitySection()],
] as const;

function emptyEverySection(): void {
  vi.mocked(listAssignedIssues).mockResolvedValue([]);
  vi.mocked(listMemberProjectsWithProgress).mockResolvedValue([]);
  vi.mocked(listRecentMentions).mockResolvedValue([]);
  vi.mocked(listInstallationActivity).mockResolvedValue([]);
  vi.mocked(countUnreadNotifications).mockResolvedValue(0);
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("every empty section says so in exactly one line (FR-040, SC-010, US1 s6, US4 s3)", () => {
  for (const [heading, mount] of sections) {
    it(`renders one line and nothing else under ${heading}`, async () => {
      emptyEverySection();

      const { container } = render((await mount()) as ReactElement);
      const lines = container.querySelectorAll("p");

      expect(lines).toHaveLength(1);
      expect(lines[0]?.textContent?.trim()).not.toBe("");
      expect(lines[0]?.textContent).not.toContain("\n");
      expect(screen.getByRole("heading", { name: heading })).not.toBeNull();
      expect(screen.queryByRole("list")).toBeNull();
      expect(screen.queryAllByRole("listitem")).toHaveLength(0);
      expect(screen.queryAllByRole("link")).toHaveLength(0);
      expect(screen.queryByRole("button")).toBeNull();
      expect(screen.queryByRole("img")).toBeNull();
      expect(container.querySelectorAll("svg")).toHaveLength(0);
    });
  }
});

describe("the three cards count down to the digit 0 rather than an empty state (D-5)", () => {
  it("renders three cards reading 0, and no quiet line at all", async () => {
    emptyEverySection();

    const { container } = render((await StatCards({ userId: USER_ID })) as ReactElement);
    const cards = screen.getAllByRole("listitem");

    expect(cards).toHaveLength(3);
    expect(cards.map((card) => card.textContent)).toEqual(["0Assigned to you", "0Due this week", "0Unread"]);
    expect(container.querySelectorAll("p")).toHaveLength(0);
    expect(container.textContent).not.toMatch(/nothing|no one|none|empty|yet/i);
  });
});