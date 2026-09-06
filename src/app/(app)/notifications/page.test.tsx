import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Suspense } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/auth/server/actor", () => ({
  requireActor: vi.fn(),
}));
vi.mock("@/features/notifications/server/notification-queries", () => ({
  listNotifications: vi.fn().mockResolvedValue([]),
  countUnreadNotifications: vi.fn().mockResolvedValue(0),
}));

import { requireActor } from "@/features/auth/server/actor";
import { MarkAllReadControl } from "@/features/notifications/components/mark-all-read-control";
import { NotificationsList } from "@/features/notifications/components/notifications-list";
import { NotificationsSkeleton } from "@/features/notifications/components/notifications-skeleton";
import { countUnreadNotifications } from "@/features/notifications/server/notification-queries";
import { ScreenHeader } from "@/features/shell/components/screen-header";
import NotificationsPage from "./page";

const ACTOR = {
  id: "member-1",
  role: "member" as const,
  firstName: "Ada",
  lastName: "Lovelace",
  avatarUrl: null,
  mustChangePassword: false,
};

const PAGE_SOURCE = readFileSync(join(process.cwd(), "src/app/(app)/notifications/page.tsx"), "utf8");

const RENDERED_SOURCES = [
  "src/app/(app)/notifications/page.tsx",
  "src/features/notifications/components/notifications-list.tsx",
  "src/features/notifications/components/notification-row.tsx",
  "src/features/notifications/components/notifications-skeleton.tsx",
];

afterEach(() => {
  vi.clearAllMocks();
});

describe("/notifications page (FR-010, FR-017, FR-018, FR-020, FR-022, FR-023)", () => {
  it("renders a ScreenHeader named Notifications with the New issue slot left empty", async () => {
    vi.mocked(requireActor).mockResolvedValue(ACTOR);

    const jsx = await NotificationsPage();
    const [header] = jsx.props.children;

    expect(header.type).toBe(ScreenHeader);
    expect(header.props.name).toBe("Notifications");
    expect(header.props.newIssue).toBeUndefined();
  });

  it("streams the list behind a Suspense boundary falling back to NotificationsSkeleton", async () => {
    vi.mocked(requireActor).mockResolvedValue(ACTOR);

    const jsx = await NotificationsPage();
    const [, boundary] = jsx.props.children;

    expect(boundary.type).toBe(Suspense);
    expect(boundary.props.fallback.type).toBe(NotificationsSkeleton);
    expect(boundary.props.children.type).toBe(NotificationsList);
  });

  it("scopes the list to the signed-in caller", async () => {
    vi.mocked(requireActor).mockResolvedValue(ACTOR);

    const jsx = await NotificationsPage();
    const [, boundary] = jsx.props.children;

    expect(boundary.props.children.props.userId).toBe("member-1");
  });

  it("redirects an unauthenticated caller before reading anything", async () => {
    vi.mocked(requireActor).mockImplementation(() => {
      throw new Error("NEXT_REDIRECT:/signin");
    });

    await expect(NotificationsPage()).rejects.toThrow("NEXT_REDIRECT:/signin");
  });

  it("resolves the unread count outside the Suspense boundary and hands it to the header control", async () => {
    vi.mocked(requireActor).mockResolvedValue(ACTOR);
    vi.mocked(countUnreadNotifications).mockResolvedValue(4);

    const jsx = await NotificationsPage();
    const [header] = jsx.props.children;

    expect(countUnreadNotifications).toHaveBeenCalledWith("member-1");
    expect(header.props.control.type).toBe(MarkAllReadControl);
    expect(header.props.control.props.unreadCount).toBe(4);
  });

  it("reads no searchParams at all, so it offers no page control and no infinite scroll", () => {
    expect(PAGE_SOURCE).not.toContain("searchParams");
  });

  it("exports no revalidate and holds no client store, so a revisit re-queries", () => {
    expect(PAGE_SOURCE).not.toMatch(/export\s+const\s+revalidate/);
    expect(PAGE_SOURCE).not.toContain("use client");
  });

  it("carries no responsive breakpoint utility anywhere in the markup it renders", () => {
    for (const path of RENDERED_SOURCES) {
      const source = readFileSync(join(process.cwd(), path), "utf8");
      expect({ path, breakpoints: source.match(/\b(sm|md|lg|xl|2xl):/g) }).toEqual({
        path,
        breakpoints: null,
      });
    }
  });
});