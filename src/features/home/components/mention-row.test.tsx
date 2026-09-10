import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { NotificationListItem } from "@/features/notifications/server/notification-queries";
import { MentionRow } from "./mention-row";

const SOURCE = readFileSync(
  join(process.cwd(), "src", "features", "home", "components", "mention-row.tsx"),
  "utf8",
);

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

function item(overrides: Partial<NotificationListItem> = {}): NotificationListItem {
  return {
    id: "n1",
    type: "mention",
    actorName: "Alan Turing",
    actorAvatarUrl: null,
    targetLabel: "WEB-142 · Fix the header",
    href: "/projects/WEB/issues/142/details#comment-c1",
    isUnread: true,
    createdAt: new Date(Date.now() - TWO_HOURS_MS),
    ...overrides,
  };
}

describe("MentionRow renders the Notifications screen's own row shape (FR-024)", () => {
  it("names the actor, what happened, the target and a relative time", () => {
    render(<MentionRow item={item()} />);

    expect(screen.getByText("Alan Turing")).not.toBeNull();
    expect(screen.getByText("mentioned you")).not.toBeNull();
    expect(screen.getByText("WEB-142 · Fix the header")).not.toBeNull();
    expect(screen.getByText("2 hours ago")).not.toBeNull();
  });

  it("shows the actor's avatar as decorative — the visible name carries the meaning", () => {
    const { container } = render(
      <MentionRow item={item({ actorAvatarUrl: "https://example.com/at.png" })} />,
    );

    const avatar = container.querySelector("img");
    expect(avatar?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByText("Alan Turing")).not.toBeNull();
  });
});

describe("MentionRow states unread in text, never in colour alone (FR-023, E-2)", () => {
  it("carries 'Unread' in the row's accessible name while the row is unread", () => {
    render(<MentionRow item={item({ isUnread: true })} />);

    expect(screen.getByRole("link", { name: /Unread/ })).not.toBeNull();
  });

  it("hides the dot itself from assistive technology", () => {
    const { container } = render(<MentionRow item={item({ isUnread: true })} />);

    expect(container.querySelector("[aria-hidden='true']")).not.toBeNull();
  });

  it("drops 'Unread' from the accessible name once the row is read", () => {
    render(<MentionRow item={item({ isUnread: false })} />);

    expect(screen.queryByRole("link", { name: /Unread/ })).toBeNull();
    expect(screen.getByRole("link")).not.toBeNull();
  });

  it("reserves the same dot-sized box on a read row, so nothing shifts", () => {
    const { container: unreadContainer } = render(<MentionRow item={item({ isUnread: true })} />);
    const { container: readContainer } = render(<MentionRow item={item({ isUnread: false })} />);

    expect(unreadContainer.querySelector(".h-2.w-2")).not.toBeNull();
    expect(readContainer.querySelector(".h-2.w-2")).not.toBeNull();
  });
});

describe("MentionRow navigates and never mutates (FR-025, FR-026, FR-042, FR-043, A-1, C-3)", () => {
  it("is a native anchor to the row's own href, comment anchor included", () => {
    render(<MentionRow item={item()} />);

    const link = screen.getByRole("link");
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("/projects/WEB/issues/142/details#comment-c1");
  });

  it("takes focus and keeps the application's visible focus indicator", () => {
    render(<MentionRow item={item()} />);

    const link = screen.getByRole("link");
    link.focus();

    expect(document.activeElement).toBe(link);
    expect(link.className).not.toMatch(/outline-none|focus:outline-none/);
  });

  it("is a Server Component that imports no mark-read path and reuses no client row", () => {
    expect(SOURCE).not.toMatch(/"use client"/);
    expect(SOURCE).not.toMatch(/markNotificationRead/);
    expect(SOURCE).not.toMatch(/markAllNotificationsRead/);
    expect(SOURCE).not.toMatch(/notification-row/);
    expect(SOURCE).not.toMatch(/onNavigate/);
  });
});