import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../server/assigned-queries", () => ({ listAssignedIssues: vi.fn() }));
vi.mock("../server/project-queries", () => ({ listMemberProjectsWithProgress: vi.fn() }));
vi.mock("../server/activity-queries", () => ({ listInstallationActivity: vi.fn() }));
vi.mock("@/features/notifications/server/notification-queries", () => ({
  countUnreadNotifications: vi.fn(),
  listRecentMentions: vi.fn(),
}));

import type { NotificationListItem } from "@/features/notifications/server/notification-queries";
import { listRecentMentions } from "@/features/notifications/server/notification-queries";
import type { InstallationActivityRow } from "../server/activity-queries";
import { listInstallationActivity } from "../server/activity-queries";
import type { AssignedIssueRow as AssignedIssue } from "../server/assigned-queries";
import { listAssignedIssues } from "../server/assigned-queries";
import type { ProjectProgressRow as ProjectProgressRowData } from "../server/project-queries";
import { listMemberProjectsWithProgress } from "../server/project-queries";
import { ActivityRow } from "./activity-row";
import { ActivitySection } from "./activity-section";
import { AssignedIssueRow } from "./assigned-issue-row";
import { AssignedSection } from "./assigned-section";
import { MentionRow } from "./mention-row";
import { MentionsSection } from "./mentions-section";
import { ProjectProgressRow } from "./project-progress-row";
import { ProjectsSection } from "./projects-section";

const USER_ID = "u1";

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

const assignedIssue: AssignedIssue = {
  id: "i1",
  key: "WEB-142",
  title: "Fix the header",
  projectName: "Website Redesign",
  href: "/projects/WEB/issues/142/details",
  dueThisWeek: true,
  priority: "none",
  dueDate: null,
};

const projectRow: ProjectProgressRowData = {
  key: "WEB",
  name: "Website Redesign",
  status: "active",
  href: "/projects/WEB",
  done: 3,
  counted: 8,
  targetDate: null,
};

const mentionItem: NotificationListItem = {
  id: "n1",
  type: "mention",
  actorName: "Alan Turing",
  actorAvatarUrl: null,
  targetLabel: "WEB-142 · Fix the header",
  href: "/projects/WEB/issues/142/details#comment-c1",
  isUnread: true,
  createdAt: new Date(Date.now() - TWO_HOURS_MS),
};

const activityRow: InstallationActivityRow = {
  id: "a1",
  kind: "created",
  actor: {
    id: "u2",
    firstName: "Ada",
    lastName: "Lovelace",
    avatarUrl: null,
    role: "member",
    jobTitle: null,
    deactivatedAt: null,
  },
  targetLabel: "WEB-142 · Fix the header",
  projectName: "Website Redesign",
  href: "/projects/WEB/issues/142/details",
  createdAt: new Date(Date.now() - TWO_HOURS_MS),
  field: null,
  fromValue: null,
  toValue: null,
};

const navigatingRows: readonly (readonly [string, () => ReactElement, RegExp, string])[] = [
  [
    "the assigned issue row",
    () => <AssignedIssueRow issue={assignedIssue} />,
    /WEB-142/,
    "/projects/WEB/issues/142/details",
  ],
  [
    "the project progress row",
    () => <ProjectProgressRow row={projectRow} />,
    /Website Redesign/,
    "/projects/WEB",
  ],
  [
    "the mention row",
    () => <MentionRow item={mentionItem} />,
    /Alan Turing/,
    "/projects/WEB/issues/142/details#comment-c1",
  ],
  [
    "the activity row",
    () => <ActivityRow row={activityRow} />,
    /Ada Lovelace/,
    "/projects/WEB/issues/142/details",
  ],
];

const sections: readonly (readonly [string, () => Promise<ReactElement>])[] = [
  ["Assigned to you", () => AssignedSection({ userId: USER_ID })],
  ["Your projects", () => ProjectsSection({ userId: USER_ID })],
  ["Mentions", () => MentionsSection({ userId: USER_ID })],
  ["Recent activity", () => ActivitySection()],
];

function seedOneRowInEverySection(): void {
  vi.mocked(listAssignedIssues).mockResolvedValue([assignedIssue]);
  vi.mocked(listMemberProjectsWithProgress).mockResolvedValue([projectRow]);
  vi.mocked(listRecentMentions).mockResolvedValue([mentionItem]);
  vi.mocked(listInstallationActivity).mockResolvedValue([activityRow]);
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("every navigating row is named, keyboard operable and visibly focused (FR-042, OT-UX-017, F-4)", () => {
  for (const [name, mount, accessibleName, href] of navigatingRows) {
    it(`gives ${name} an accessible name taken from its own text`, () => {
      render(mount());

      const link = screen.getByRole("link", { name: accessibleName });

      expect(link.tagName).toBe("A");
      expect(link.getAttribute("href")).toBe(href);
      expect(link.textContent?.trim()).not.toBe("");
    });

    it(`keeps ${name} in the natural tab order and operable by keyboard`, () => {
      render(mount());

      const link = screen.getByRole("link", { name: accessibleName });

      expect(link.getAttribute("tabindex")).toBeNull();
      expect(link.getAttribute("aria-hidden")).toBeNull();

      link.focus();
      expect(document.activeElement).toBe(link);

      fireEvent.keyDown(link, { key: "Enter" });
      fireEvent.keyUp(link, { key: "Enter" });
      expect(document.activeElement).toBe(link);

      fireEvent.keyDown(link, { key: "Tab" });
      expect(document.activeElement).toBe(link);
    });

    it(`leaves ${name}'s visible focus indicator in place`, () => {
      render(mount());

      const link = screen.getByRole("link", { name: accessibleName });

      expect(link.className).not.toMatch(/outline-none/);
      expect(link.getAttribute("style") ?? "").not.toMatch(/outline/);
    });
  }
});

describe("every section is a labelled region navigable by heading (FR-042, OT-UX-019)", () => {
  for (const [heading, mount] of sections) {
    it(`labels the ${heading} region with its own heading`, async () => {
      seedOneRowInEverySection();

      render(await mount());

      expect(screen.getByRole("region", { name: heading })).not.toBeNull();
      expect(screen.getByRole("heading", { name: heading })).not.toBeNull();
    });
  }
});

describe("no state on Home is conveyed by colour alone (FR-023, OT-UX-018, E-2)", () => {
  it("states an unread mention in text as well as in its dot", () => {
    render(<MentionRow item={mentionItem} />);

    expect(screen.getByRole("link", { name: /Unread/ })).not.toBeNull();
  });

  it("hides the unread dot itself from assistive technology", () => {
    const { container } = render(<MentionRow item={mentionItem} />);

    const dot = container.querySelector(".rounded-full");

    expect(dot).not.toBeNull();
    expect(dot?.getAttribute("aria-hidden")).toBe("true");
    expect(dot?.textContent).toBe("");
  });

  it("states a project's status and its progress as text", () => {
    render(<ProjectProgressRow row={projectRow} />);

    expect(screen.getByText("active")).not.toBeNull();
    expect(screen.getByText("38%")).not.toBeNull();
  });

  it("keeps every icon and avatar decorative — visible text alone carries each row's meaning", () => {
    for (const [, mount] of navigatingRows) {
      const { container } = render(mount());

      for (const el of Array.from(container.querySelectorAll("img, svg"))) {
        expect(el.getAttribute("aria-hidden")).toBe("true");
      }
      cleanup();
    }
  });
});