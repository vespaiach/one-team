import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { NotificationListItem } from "../server/notification-queries";
import { NotificationRow } from "./notification-row";

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

describe("NotificationRow (FR-012, FR-013, FR-014, FR-015)", () => {
  it("reads a mention as 'mentioned you'", () => {
    render(<NotificationRow item={item({ type: "mention" })} />);

    expect(screen.getByText("mentioned you")).not.toBeNull();
  });

  it("reads an assignment as 'assigned you'", () => {
    render(<NotificationRow item={item({ type: "assignment" })} />);

    expect(screen.getByText("assigned you")).not.toBeNull();
  });

  it("reads a comment as 'commented'", () => {
    render(<NotificationRow item={item({ type: "comment" })} />);

    expect(screen.getByText("commented")).not.toBeNull();
  });

  it("renders the actor's display name and the target it happened on", () => {
    render(<NotificationRow item={item()} />);

    expect(screen.getByText("Alan Turing")).not.toBeNull();
    expect(screen.getByText("WEB-142 · Fix the header")).not.toBeNull();
  });

  it("renders a relative time from Intl.RelativeTimeFormat", () => {
    render(<NotificationRow item={item()} />);

    expect(screen.getByText("2 hours ago")).not.toBeNull();
  });

  it("links to the row's server-composed href, comment fragment included", () => {
    render(<NotificationRow item={item()} />);

    expect(screen.getByRole("link").getAttribute("href")).toBe("/projects/WEB/issues/142/details#comment-c1");
  });
});

describe("NotificationRow states the unread state in the accessible name, never in colour alone (SC-016)", () => {
  it("carries 'Unread' in the row's accessible name while the row is unread", () => {
    render(<NotificationRow item={item({ isUnread: true })} />);

    expect(screen.getByRole("link", { name: /Unread/ })).not.toBeNull();
  });

  it("drops 'Unread' from the accessible name once the row is read", () => {
    render(<NotificationRow item={item({ isUnread: false })} />);

    expect(screen.queryByRole("link", { name: /Unread/ })).toBeNull();
    expect(screen.getByRole("link")).not.toBeNull();
  });

  it("hides the dot from assistive technology, so the word carries the state and the dot decorates it", () => {
    const { container } = render(<NotificationRow item={item({ isUnread: true })} />);

    expect(container.querySelector("[aria-hidden='true']")).not.toBeNull();
  });
});

describe("NotificationRow is keyboard operable with a visible focus indicator (FR-074)", () => {
  it("is a native anchor carrying an href, which Enter activates and globals.css outlines", () => {
    render(<NotificationRow item={item()} />);

    const link = screen.getByRole("link");
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).not.toBe("");
    expect(link.className).not.toMatch(/outline-none|focus:outline-none/);
  });

  it("takes focus", () => {
    render(<NotificationRow item={item()} />);

    const link = screen.getByRole("link");
    link.focus();

    expect(document.activeElement).toBe(link);
  });
});